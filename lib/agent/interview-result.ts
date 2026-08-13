import { extractJsonFromText } from "@/lib/agent/parse-json"
import type { InterviewResult } from "@/lib/agent/types"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

export function parseInterviewResult(text: string): InterviewResult {
  const result = extractJsonFromText<unknown>(text)

  if (!isRecord(result) || !Array.isArray(result.questions)) {
    throw new Error("AI 面试结果缺少问题列表")
  }

  // 允许 3-5 道题；每题校验精简后的核心字段
  const questionCount = result.questions.length
  const questionsAreValid = questionCount >= 3
    && questionCount <= 5
    && result.questions.every((question) => {
      if (!isRecord(question)) return false

      return isNonEmptyString(question.id)
        && typeof question.category === "string"
        && typeof question.difficulty === "string"
        && isNonEmptyString(question.question)
        && isNonEmptyString(question.intent)
        && isNonEmptyString(question.referenceAnswer)
        && isNonEmptyString(question.answerStrategy)
        && isNonEmptyString(question.personalizedBridge)
    })

  if (
    !questionsAreValid
    || !isStringArray(result.preparationChecklist)
    || result.preparationChecklist.length !== 3
  ) {
    throw new Error("AI 面试结果字段不完整")
  }

  return result as unknown as InterviewResult
}
