export const FEEDBACK_TYPES = ["bug", "stuck", "feature", "other"] as const
export type FeedbackType = (typeof FEEDBACK_TYPES)[number]

export const BUG_STEPS = [
  "open-page",
  "upload-resume",
  "parse-resume",
  "match-score",
  "pdf-generate",
  "resume-export",
  "interview",
] as const

export const STUCK_STEPS = [
  "upload-resume",
  "parse-resume",
  "match-score",
  "pdf-generate",
  "resume-export",
] as const

export type BugStep = (typeof BUG_STEPS)[number]
export type StuckStep = (typeof STUCK_STEPS)[number]
export type FeedbackStep = BugStep

export const STEP_LABELS: Record<BugStep, string> = {
  "open-page": "打开页面",
  "upload-resume": "上传简历",
  "parse-resume": "解析简历",
  "match-score": "匹配分数生成",
  "pdf-generate": "PDF简历生成",
  "resume-export": "简历导出",
  interview: "面试模拟",
}

export const FEEDBACK_TYPE_META: Record<
  FeedbackType,
  { label: string; emoji: string }
> = {
  bug: { label: "Bug 报错", emoji: "🐛" },
  stuck: { label: "执行卡顿", emoji: "⛔" },
  feature: { label: "需要新功能", emoji: "💡" },
  other: { label: "其他", emoji: "💬" },
}

export const OTHER_EXAMPLES = [
  "匹配度分数不够准确",
  "页面交互逻辑不符合产品使用习惯，左右布局影响使用",
  "模拟面试回答问题深度不够，对数据的描述存在出入",
] as const

export interface FeedbackPayload {
  type: FeedbackType
  steps?: FeedbackStep[]
  reproducible?: boolean
  errorText?: string
  message?: string
  contact?: string
  /** 1–5，步进 0.5；未评不传 */
  rating?: number
  page?: string
}

export type FeedbackField = "type" | "steps" | "reproducible" | "errorText" | "message"
export type FeedbackFieldErrors = Partial<Record<FeedbackField, string>>
