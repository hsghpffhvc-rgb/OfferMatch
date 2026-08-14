import { runAgentPipeline } from "@/lib/agent/run-agent"
import { createSSEStream } from "@/lib/agent/sse"
import { assertAiConfigured } from "@/lib/agent/ai-config"
import type { ChatRequestBody } from "@/lib/agent/types"

export const runtime = "nodejs"
export const maxDuration = 120

export async function POST(request: Request) {
  try {
    assertAiConfigured()
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI 未配置"
    return Response.json({ error: message, code: "AI_CONFIG_ERROR" }, { status: 503 })
  }

  let body: ChatRequestBody

  try {
    body = (await request.json()) as ChatRequestBody
  } catch {
    return Response.json({ error: "请求体必须是合法 JSON" }, { status: 400 })
  }

  const jd = body.jd?.trim()
  if (!jd) {
    return Response.json({ error: "请提供岗位 JD 文本（jd 字段）" }, { status: 400 })
  }

  const resume = body.resume?.trim() ?? ""

  const stream = createSSEStream(async (emit) => {
    await runAgentPipeline(jd, resume, emit)
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}
