import { runInterviewPipeline } from "@/lib/agent/run-agent"
import { createSSEStream } from "@/lib/agent/sse"
import { validateInterviewBank } from "@/lib/agent/interview-fallback"
import type { InterviewRequestBody } from "@/lib/agent/types"

export const runtime = "nodejs"
export const maxDuration = 120

export async function POST(request: Request) {
  const bankCheck = validateInterviewBank()
  if (!bankCheck.ok) {
    return Response.json(
      {
        error: "题库未就绪，请联系管理员",
        missingCategories: bankCheck.missingCategories,
      },
      { status: 503 },
    )
  }

  let body: InterviewRequestBody

  try {
    body = (await request.json()) as InterviewRequestBody
  } catch {
    return Response.json({ error: "请求体必须是合法 JSON" }, { status: 400 })
  }

  const jd = body.jd?.trim()
  if (!jd) {
    return Response.json({ error: "请提供岗位 JD 文本（jd 字段）" }, { status: 400 })
  }

  if (!body.context || typeof body.context !== "object") {
    return Response.json({ error: "请提供候选人面试证据（context 字段）" }, { status: 400 })
  }

  const stream = createSSEStream(async (emit) => {
    await runInterviewPipeline(jd, body.context, emit)
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}
