"use client"

import type { PersonaResult, RewriteResult, ResultSource } from "@/lib/agent/types"
import { getAnonymousVisitorId, getPostHogDistinctId } from "@/lib/visitor"

export async function saveCloudAnalysisSession(input: {
  sessionId: string
  persona: PersonaResult
  rewrite: RewriteResult
  jd: string
  resume: string
  source?: ResultSource | null
}): Promise<void> {
  const jd = input.jd.trim()
  const resume = input.resume.trim()

  await fetch("/api/analysis-sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: input.sessionId,
      anonymousId: getAnonymousVisitorId(),
      posthogDistinctId: getPostHogDistinctId(),
      persona: input.persona,
      rewrite: input.rewrite,
      source: input.source ?? input.rewrite.source ?? input.persona.source ?? "model",
      hasResume: resume.length > 0,
      jdChars: jd.length,
      resumeChars: resume.length,
      jdPreview: jd.slice(0, 180),
      pageUrl: window.location.href,
    }),
    keepalive: true,
  }).catch(() => {
    // 云端历史失败不影响用户生成主流程
  })
}
