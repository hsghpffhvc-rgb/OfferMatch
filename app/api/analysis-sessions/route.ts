import type { PersonaResult, RewriteResult, ResultSource } from "@/lib/agent/types"
import { saveAnalysisSession } from "@/lib/supabase-admin"

export const runtime = "nodejs"
export const maxDuration = 30

interface AnalysisSessionPayload {
  sessionId?: unknown
  anonymousId?: unknown
  posthogDistinctId?: unknown
  persona?: unknown
  rewrite?: unknown
  source?: unknown
  hasResume?: unknown
  jdChars?: unknown
  resumeChars?: unknown
  jdPreview?: unknown
  pageUrl?: unknown
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

export async function POST(request: Request) {
  let body: AnalysisSessionPayload
  try {
    body = (await request.json()) as AnalysisSessionPayload
  } catch {
    return Response.json({ error: "请求体必须是合法 JSON" }, { status: 400 })
  }

  const persona = body.persona as PersonaResult | undefined
  const rewrite = body.rewrite as RewriteResult | undefined
  if (!persona?.title || !rewrite?.scores) {
    return Response.json({ error: "缺少分析结果" }, { status: 400 })
  }

  try {
    await saveAnalysisSession({
      session_id: asString(body.sessionId, crypto.randomUUID()),
      anonymous_id: asString(body.anonymousId) || null,
      posthog_distinct_id: asString(body.posthogDistinctId) || null,
      title: persona.title.trim().slice(0, 120) || "未命名岗位",
      industry: persona.industry?.trim().slice(0, 80) || "",
      score_before: rewrite.scores.overallBefore ?? 0,
      score_after: rewrite.scores.overallAfter ?? 0,
      label: rewrite.scores.label?.slice(0, 80) ?? "",
      has_resume: Boolean(body.hasResume),
      jd_chars: asNumber(body.jdChars),
      resume_chars: asNumber(body.resumeChars),
      jd_preview: asString(body.jdPreview).slice(0, 180),
      source: (asString(body.source, "model") as ResultSource) || "model",
      persona,
      rewrite,
      page_url: asString(body.pageUrl).slice(0, 300) || null,
      user_agent: request.headers.get("user-agent"),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "保存失败"
    return Response.json({ error: message }, { status: 500 })
  }

  return Response.json({ ok: true })
}
