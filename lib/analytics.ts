import posthog from "posthog-js"

import { isPostHogEnabled } from "@/lib/posthog-env"

/** 业务事件名：统一前缀，方便在 PostHog 筛选 */
export const AnalyticsEvent = {
  analysisStarted: "analysis_started",
  analysisCompleted: "analysis_completed",
  analysisFailed: "analysis_failed",
  resumeUploaded: "resume_uploaded",
  jdUploaded: "jd_uploaded",
  pdfExported: "pdf_exported",
  pdfExportFailed: "pdf_export_failed",
  interviewStarted: "interview_started",
  interviewCompleted: "interview_completed",
  interviewFailed: "interview_failed",
  interviewAnswerCopied: "interview_answer_copied",
  templatesViewed: "templates_viewed",
  feedbackSubmitted: "feedback_submitted",
  homeViewed: "home_viewed",
  historyViewed: "history_viewed",
  historyRestored: "history_restored",
} as const

export type AnalyticsEventName =
  (typeof AnalyticsEvent)[keyof typeof AnalyticsEvent]

function canCapture(): boolean {
  return (
    typeof window !== "undefined" &&
    isPostHogEnabled() &&
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

/**
 * 把当前匿名访客与用户身份关联（如反馈时留了邮箱/微信）。
 * 用于漏斗与留存分析中把「访客」归并为「用户」。
 */
export function identify(distinctId: string): void {
  if (
    typeof window === "undefined"
    || !isPostHogEnabled()
    || typeof posthog?.identify !== "function"
  ) {
    return
  }
  try {
    posthog.identify(distinctId)
  } catch {
    // 关联失败不影响主流程
  }
}

/**
 * 生成稳定的匿名标识（FNV-1a 简化版），
 * 避免把用户真实邮箱 / 微信等原始联系方式上报到 PostHog。
 */
export function hashString(input: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return `anon-${(hash >>> 0).toString(36)}`
}
