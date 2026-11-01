import { runEvidenceGapPipeline, runEvidenceRefinePipeline } from "@/lib/agent/run-agent"
import { createSSEStream } from "@/lib/agent/sse"
import { buildEvidenceGapContext } from "@/lib/agent/evidence-gap"
import type { EvidenceGapRequestBody } from "@/lib/agent/types"

export const runtime = "nodejs"
export const maxDuration = 120

const MAX_JD_CHARS = 6000
const MAX_ANSWER_CHARS = 1200
const MAX_ANSWERS = 6

export async function POST(request: Request) {
  let body: EvidenceGapRequestBody

  try {
    body = (await request.json()) as EvidenceGapRequestBody
  } catch {
    return Response.json({ error: "请求体必须是合法 JSON" }, { status: 400 })
  }

  const action = body.action === "refine" ? "refine" : body.action === "ask" ? "ask" : null
  if (!action) {
    return Response.json({ error: "action 必须是 ask 或 refine" }, { status: 400 })
  }

  const jd = body.jd?.trim().slice(0, MAX_JD_CHARS)
  if (!jd) {
    return Response.json({ error: "请提供岗位 JD 文本（jd 字段）" }, { status: 400 })
  }

  if (!body.persona || typeof body.persona !== "object") {
    return Response.json({ error: "请提供候选人画像（persona 字段）" }, { status: 400 })
  }

  // rewrite 可选：前置证据收集阶段还没有重写结果，基于原始简历文本构建上下文
  const rewrite = body.rewrite && typeof body.rewrite === "object" ? body.rewrite : null

  // refine 动作仍需要 rewrite（回填场景）；ask 动作可无 rewrite
  if (action === "refine" && !rewrite) {
    return Response.json({ error: "请提供分析结果（rewrite 字段）" }, { status: 400 })
  }

  // 上下文统一在服务端压缩，避免客户端传入不一致的 evidence context
  const context = buildEvidenceGapContext(body.persona, body.resume ?? "", rewrite)

  if (action === "ask") {
    const stream = createSSEStream(async (emit) => {
      await runEvidenceGapPipeline(jd, context, emit)
    })
    return sseResponse(stream)
  }

  const answers = Array.isArray(body.answers) ? body.answers : []
  const effectiveAnswers = answers
    .filter((answer) => answer && typeof answer.answer === "string")
    .filter((answer) => !answer.skipped && answer.answer.trim().length > 0)
    .slice(0, MAX_ANSWERS)
    .map((answer) => ({
      gapId: String(answer.gapId ?? "").slice(0, 40),
      keyword: String(answer.keyword ?? "").slice(0, 40),
      question: typeof answer.question === "string" ? answer.question.slice(0, 100) : undefined,
      answer: answer.answer.trim().slice(0, MAX_ANSWER_CHARS),
      skipped: false,
    }))

  if (effectiveAnswers.length === 0) {
    return Response.json({ error: "请至少回答一条追问" }, { status: 400 })
  }

  if (context.experiences.length === 0) {
    return Response.json({ error: "当前简历没有可回填的经历章节" }, { status: 400 })
  }

  const stream = createSSEStream(async (emit) => {
    await runEvidenceRefinePipeline(jd, context, effectiveAnswers, emit)
  })

  return sseResponse(stream)
}

function sseResponse(stream: ReadableStream<Uint8Array>): Response {
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}
