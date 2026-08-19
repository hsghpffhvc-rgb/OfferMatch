import {
  BUG_STEPS,
  FEEDBACK_TYPES,
  STUCK_STEPS,
  type BugStep,
  type FeedbackFieldErrors,
  type FeedbackPayload,
  type FeedbackType,
  type StuckStep,
} from "@/types/feedback"

const BUG_STEP_SET = new Set<string>(BUG_STEPS)
const STUCK_STEP_SET = new Set<string>(STUCK_STEPS)

const RATING_STEPS = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5] as const

function parseRating(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined
  const snapped = Math.round(value * 2) / 2
  return (RATING_STEPS as readonly number[]).includes(snapped) ? snapped : undefined
}

export interface FeedbackFormValues {
  type: FeedbackType | null
  bugSteps: BugStep[]
  stuckSteps: StuckStep[]
  reproducible: boolean | null
  errorText: string
  message: string
  contact: string
  rating: number | null
}

function isFeedbackType(value: unknown): value is FeedbackType {
  return (
    typeof value === "string" &&
    (FEEDBACK_TYPES as readonly string[]).includes(value)
  )
}

function uniqueSteps<T extends string>(steps: T[], allowed: Set<string>): T[] {
  return [...new Set(steps)].filter((step) => allowed.has(step))
}

export function validateFeedbackForm(
  values: FeedbackFormValues,
): { ok: true; data: FeedbackPayload } | { ok: false; errors: FeedbackFieldErrors } {
  const errors: FeedbackFieldErrors = {}

  if (!values.type) {
    errors.type = "请选择反馈类型"
    return { ok: false, errors }
  }

  const contact = values.contact.trim().slice(0, 120)
  const message = values.message.trim().slice(0, 2000)
  const errorText = values.errorText.trim().slice(0, 2000)
  const rating = parseRating(values.rating)

  if (values.type === "bug") {
    const steps = uniqueSteps(values.bugSteps, BUG_STEP_SET)
    if (steps.length === 0) {
      errors.steps = "请勾选发生在哪一步"
    }
    if (!errorText) {
      errors.errorText = "请填写页面上的报错提示"
    }
    if (values.reproducible === null) {
      errors.reproducible = "请选择能否复现"
    }
    if (Object.keys(errors).length > 0) {
      return { ok: false, errors }
    }
    return {
      ok: true,
      data: {
        type: "bug",
        steps,
        errorText,
        reproducible: values.reproducible === true,
        contact: contact || undefined,
        rating,
      },
    }
  }

  if (values.type === "stuck") {
    const steps = uniqueSteps(values.stuckSteps, STUCK_STEP_SET)
    if (steps.length === 0) {
      return { ok: false, errors: { steps: "请勾选卡顿发生在哪一步" } }
    }
    return {
      ok: true,
      data: {
        type: "stuck",
        steps,
        contact: contact || undefined,
        rating,
      },
    }
  }

  if (values.type === "feature") {
    if (message.length < 2) {
      return { ok: false, errors: { message: "请填写你想要的功能" } }
    }
    return {
      ok: true,
      data: {
        type: "feature",
        message,
        contact: contact || undefined,
        rating,
      },
    }
  }

  if (message.length < 2) {
    return { ok: false, errors: { message: "请简单说明一下" } }
  }
  return {
    ok: true,
    data: {
      type: "other",
      message,
      contact: contact || undefined,
      rating,
    },
  }
}

export function parseFeedbackBody(
  body: unknown,
): { ok: true; data: FeedbackPayload } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "请求体必须是合法 JSON" }
  }

  const raw = body as Record<string, unknown>
  if (!isFeedbackType(raw.type)) {
    return { ok: false, error: "请选择反馈类型" }
  }

  const rawSteps = Array.isArray(raw.steps)
    ? raw.steps.filter((step): step is string => typeof step === "string")
    : []

  const values: FeedbackFormValues = {
    type: raw.type,
    bugSteps: uniqueSteps(rawSteps, BUG_STEP_SET) as BugStep[],
    stuckSteps: uniqueSteps(rawSteps, STUCK_STEP_SET) as StuckStep[],
    reproducible:
      typeof raw.reproducible === "boolean" ? raw.reproducible : null,
    errorText:
      typeof raw.errorText === "string"
        ? raw.errorText
        : typeof raw.error_text === "string"
          ? raw.error_text
          : "",
    message: typeof raw.message === "string" ? raw.message : "",
    contact: typeof raw.contact === "string" ? raw.contact : "",
    rating: parseRating(raw.rating) ?? null,
  }

  const result = validateFeedbackForm(values)
  if (!result.ok) {
    const error = Object.values(result.errors)[0] ?? "请完善反馈内容"
    return { ok: false, error }
  }

  const page = typeof raw.page === "string" ? raw.page.slice(0, 200) : undefined
  return {
    ok: true,
    data: {
      ...result.data,
      page,
    },
  }
}

