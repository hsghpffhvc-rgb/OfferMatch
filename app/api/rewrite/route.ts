import { runRewritePipeline } from "@/lib/agent/run-agent"
import { createSSEStream } from "@/lib/agent/sse"
import type { OutlineResult, PersonaResult } from "@/lib/agent/types"

export const runtime = "nodejs"
export const maxDuration = 120

const MAX_JD_CHARS = 6000
const MAX_RESUME_CHARS = 20_000
const MAX_EVIDENCE_CHARS = 8_000

export async function POST(request: Request) {
  let body: {
    jd?: string
    persona?: PersonaResult
    outline?: OutlineResult
    resume?: string
    evidence?: string
  }

  try {
    body = (await request.json()) as typeof body
  } catch {
    return Response.json({ error: "请求体必须是合法 JSON" }, { status: 400 })
  }

  const jd = body.jd?.trim().slice(0, MAX_JD_CHARS)
  if (!jd) {
    return Response.json({ error: "请提供岗位 JD 文本（jd 字段）" }, { status: 400 })
  }

  if (!body.persona || typeof body.persona !== "object") {
    return Response.json({ error: "请提供候选人画像（persona 字段）" }, { status: 400 })
  }

  if (!body.outline || typeof body.outline !== "object") {
    return Response.json({ error: "请提供简历大纲（outline 字段）" }, { status: 400 })
  }

  const resume = (body.resume ?? "").trim().slice(0, MAX_RESUME_CHARS)
  const evidence = (body.evidence ?? "").trim().slice(0, MAX_EVIDENCE_CHARS)

  const stream = createSSEStream(async (emit) => {
    await runRewritePipeline(jd, body.persona!, body.outline!, resume, evidence, emit)
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}
