import posthog from "posthog-js"

/** 业务事件名：统一前缀，方便在 PostHog 筛选 */
export const AnalyticsEvent = {
  analysisStarted: "analysis_started",
  analysisCompleted: "analysis_completed",
  analysisFailed: "analysis_failed",
  resumeUploaded: "resume_uploaded",
  jdUploaded: "jd_uploaded",
  pdfExported: "pdf_exported",
  interviewStarted: "interview_started",
  interviewCompleted: "interview_completed",
  interviewFailed: "interview_failed",
  interviewAnswerCopied: "interview_answer_copied",
  templatesViewed: "templates_viewed",
  feedbackSubmitted: "feedback_submitted",
} as const

export type AnalyticsEventName =
  (typeof AnalyticsEvent)[keyof typeof AnalyticsEvent]

function canCapture(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY) &&
    typeof posthog?.capture === "function"
  )
}

/**
 * 上报自定义事件。勿传入完整 JD / 简历正文等敏感内容。
 */
export function track(
  event: AnalyticsEventName | string,
  properties?: Record<string, string | number | boolean | null | undefined>,
): void {
  if (!canCapture()) return
  try {
    posthog.capture(event, properties)
  } catch {
    // 埋点失败不影响主流程
  }
}
