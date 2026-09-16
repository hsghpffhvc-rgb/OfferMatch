import { getModel, getOpenAIClient, shouldDisableThinking } from "@/lib/openai"
import { extractJsonFromText } from "@/lib/agent/parse-json"
import { sanitizeRewriteResult } from "@/lib/agent/keyword-filter"
import { parseInterviewResult } from "@/lib/agent/interview-result"
import {
  PHASE_A_SYSTEM,
  PHASE_B_SYSTEM,
  PHASE_C_SYSTEM,
  buildPhaseAUserPrompt,
  buildPhaseBUserPrompt,
  buildPhaseCUserPrompt,
} from "@/lib/agent/prompts"
import {
  PHASE_D_SYSTEM,
  buildPhaseDUserPrompt,
} from "@/lib/agent/prompts-interview"
import type { InterviewContext } from "@/lib/agent/interview-context"
import { buildFallbackInterview } from "@/lib/agent/interview-fallback"
import {
  getFallbackOutline,
  getFallbackPersona,
  getFallbackRewrite,
} from "@/lib/agent/fallback-content"
import { assertAiConfigured, isAiConfigError } from "@/lib/agent/ai-config"
import type {
  AgentAnalysisResult,
  AgentPhase,
  InterviewResult,
  OutlineResult,
  PersonaResult,
  ResultSource,
  RewriteResult,
  StreamEventEmitter,
} from "@/lib/agent/types"

interface StreamMetrics {
  firstTokenMs: number | null
  totalMs: number
  outputChars: number
  finishReason: string | null
}

interface StreamPhaseOptions {
  publishContent?: boolean
  maxCompletionTokens?: number
  jsonMode?: boolean
  temperature?: number
  timeoutMs?: number
  onMetrics?: (metrics: StreamMetrics) => void
}

const RETRY_DELAYS_MS = [1000, 3000] as const

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function streamPhase(
  phase: AgentPhase,
  system: string,
  user: string,
  emit: StreamEventEmitter,
  options: StreamPhaseOptions = {},
): Promise<string> {
  const openai = getOpenAIClient()
  const model = getModel()

  emit({
    type: "phase",
    phase,
    status: "start",
    message:
      phase === "A"
        ? "正在深度解析职位描述…"
        : phase === "B"
          ? "正在逆向推导理想简历大纲…"
          : phase === "C"
            ? "正在对比重写简历…"
            : "正在生成面试问题…",
  })

  const stream = await openai.chat.completions.create(
    {
      model,
      temperature: options.temperature ?? 0.4,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      stream: true,
      ...(options.jsonMode
        ? { response_format: { type: "json_object" as const } }
        : {}),
      ...(options.maxCompletionTokens
        ? { max_completion_tokens: options.maxCompletionTokens }
        : {}),
      // DashScope's OpenAI-compatible API expects this extension at the top level.
      ...(shouldDisableThinking() ? { enable_thinking: false } : {}),
    },
    options.timeoutMs ? { timeout: options.timeoutMs } : undefined,
  )

  let fullText = ""
  const startedAt = Date.now()
  let firstTokenAt: number | null = null
  let finishReason: string | null = null

  for await (const chunk of stream) {
    finishReason = chunk.choices[0]?.finish_reason ?? finishReason
    const delta = chunk.choices[0]?.delta?.content ?? ""
    if (!delta) continue
    firstTokenAt ??= Date.now()
    fullText += delta
    if (options.publishContent !== false) {
      emit({ type: "reasoning", phase, content: delta })
    }
  }

  options.onMetrics?.({
    firstTokenMs: firstTokenAt === null ? null : firstTokenAt - startedAt,
    totalMs: Date.now() - startedAt,
    outputChars: fullText.length,
    finishReason,
  })

  if (finishReason === "length") {
    throw new Error("AI 输出达到长度上限，请重试")
  }

  if (!fullText.trim()) {
    throw new Error("AI 返回空内容")
  }

  return fullText
}

/**
 * streamPhase 重试装饰：共 3 次尝试，失败间隔 1s / 3s。
 * 全部失败时抛出最后一次错误，由调用方切换预置兜底数据。
 */
async function streamPhaseWithRetry(
  phase: AgentPhase,
  system: string,
  user: string,
  emit: StreamEventEmitter,
  options: StreamPhaseOptions = {},
): Promise<string> {
  let lastError: unknown

  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_DELAYS_MS[attempt - 1] ?? 3000
      console.warn(`streamPhase retry phase=${phase} attempt=${attempt + 1} delayMs=${delay}`)
      await sleep(delay)
    }

    try {
      return await streamPhase(phase, system, user, emit, options)
    } catch (error) {
      lastError = error
      const reason = error instanceof Error ? error.message : "unknown error"
      console.warn(`streamPhase failed phase=${phase} attempt=${attempt + 1}: ${reason}`)
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`阶段 ${phase} 调用失败`)
}

async function streamJsonPhaseWithRetry<T>(
  phase: AgentPhase,
  system: string,
  user: string,
  emit: StreamEventEmitter,
  parse: (text: string) => T,
  options: StreamPhaseOptions = {},
  maxAttempts = 3,
): Promise<T> {
  let lastError: unknown

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      const delay = RETRY_DELAYS_MS[attempt - 1] ?? 3000
      console.warn(`streamJsonPhase retry phase=${phase} attempt=${attempt + 1} delayMs=${delay}`)
      await sleep(delay)
    }

    try {
      const text = await streamPhase(phase, system, user, emit, options)
      return parse(text)
    } catch (error) {
      lastError = error
      const reason = error instanceof Error ? error.message : "unknown error"
      console.warn(`streamJsonPhase failed phase=${phase} attempt=${attempt + 1}: ${reason}`)
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`阶段 ${phase} 生成或解析失败`)
}

/** 分析阶段共用：纯 JSON 输出，不把模型原文推到前端生成框 */
const ANALYSIS_STREAM_OPTIONS: StreamPhaseOptions = {
  publishContent: false,
  jsonMode: true,
}

function markSource<T extends { source?: ResultSource }>(
  data: T,
  source: ResultSource,
): T {
  return { ...data, source }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
}

function parsePersona(text: string): PersonaResult {
  const value = extractJsonFromText<unknown>(text)
  if (!isRecord(value)) throw new Error("阶段 A 返回结构不完整")
  const fallback = getFallbackPersona()
  return {
    title: typeof value.title === "string" ? value.title : fallback.title,
    industry: typeof value.industry === "string" ? value.industry : fallback.industry,
    hardSkills: isStringArray(value.hardSkills) ? value.hardSkills : fallback.hardSkills,
    softSkills: isStringArray(value.softSkills) ? value.softSkills : fallback.softSkills,
    businessPainPoints: isStringArray(value.businessPainPoints)
      ? value.businessPainPoints
      : fallback.businessPainPoints,
    interviewKeywords: isStringArray(value.interviewKeywords)
      ? value.interviewKeywords
      : fallback.interviewKeywords,
    optimizationAdvice: isStringArray(value.optimizationAdvice)
      ? value.optimizationAdvice
      : fallback.optimizationAdvice,
  }
}

function parseOutline(text: string): OutlineResult {
  const value = extractJsonFromText<unknown>(text)
  if (!isRecord(value)) throw new Error("阶段 B 返回结构不完整")
  const fallback = getFallbackOutline()
  const sections = Array.isArray(value.sections)
    ? value.sections.filter(isRecord).map((section) => ({
        heading: typeof section.heading === "string" ? section.heading : "简历内容",
        bullets: isStringArray(section.bullets) ? section.bullets : [],
      }))
    : fallback.sections
  return {
    summary: typeof value.summary === "string" ? value.summary : fallback.summary,
    sections: sections.length ? sections : fallback.sections,
    keyHighlights: isStringArray(value.keyHighlights)
      ? value.keyHighlights
      : fallback.keyHighlights,
  }
}

function parseRewrite(
  text: string,
  resumeText: string,
  outline: OutlineResult,
): RewriteResult {
  const value = extractJsonFromText<unknown>(text)
  if (!isRecord(value)) throw new Error("阶段 C 返回结构不完整")

  const fallback = getFallbackRewrite(resumeText, outline)
  const scoresValue = isRecord(value.scores) ? value.scores : {}
  const resumeValue = isRecord(value.resume) ? value.resume : {}
  const basicsValue = isRecord(resumeValue.basics) ? resumeValue.basics : {}
  const summaryValue = isRecord(resumeValue.summary) ? resumeValue.summary : {}

  const score = (key: keyof typeof fallback.scores) => {
    const candidate = scoresValue[key]
    const defaultValue = fallback.scores[key]
    if (!isRecord(candidate) || !isRecord(defaultValue)) return defaultValue
    return {
      ...defaultValue,
      before: typeof candidate.before === "number" ? candidate.before : defaultValue.before,
      after: typeof candidate.after === "number" ? candidate.after : defaultValue.after,
      gaps: isStringArray(candidate.gaps) ? candidate.gaps : defaultValue.gaps,
      improvements: isStringArray(candidate.improvements)
        ? candidate.improvements
        : defaultValue.improvements,
    }
  }

  const keywordValue = isRecord(scoresValue.keywordAnalysis)
    ? scoresValue.keywordAnalysis
    : {}
  const keywordFallback = fallback.scores.keywordAnalysis
  const normalizedSections = Array.isArray(resumeValue.sections)
    ? resumeValue.sections.filter(isRecord).map((section) => ({
        ...section,
        type: typeof section.type === "string" ? section.type : "experience",
        title: typeof section.title === "string" ? section.title : "简历内容",
        items: Array.isArray(section.items)
          ? section.items.filter(isRecord).map((item) => ({
              ...item,
              highlights: Array.isArray(item.highlights)
                ? item.highlights.filter(isRecord)
                : [],
            }))
          : [],
      }))
    : fallback.resume.sections
  const normalizedSkills = Array.isArray(resumeValue.skills)
    ? resumeValue.skills.filter(isRecord).map((group) => ({
        ...group,
        group: typeof group.group === "string" ? group.group : "专业技能",
        items: Array.isArray(group.items) ? group.items.filter(isRecord) : [],
      }))
    : fallback.resume.skills
  const normalizedModifications = Array.isArray(value.modifications)
    ? value.modifications.filter(isRecord).map((item) => ({
        section: typeof item.section === "string" ? item.section : "简历内容",
        original: typeof item.original === "string" ? item.original : "",
        rewritten: typeof item.rewritten === "string" ? item.rewritten : "",
        rationale: typeof item.rationale === "string" ? item.rationale : "",
        matchedKeywords: isStringArray(item.matchedKeywords) ? item.matchedKeywords : [],
      }))
    : fallback.modifications

  const normalized = {
    source: "model",
    scores: {
      keywordCoverage: score("keywordCoverage"),
      hardSkillMatch: score("hardSkillMatch"),
      softSkillMatch: score("softSkillMatch"),
      experienceRelevance: score("experienceRelevance"),
      quantification: score("quantification"),
      starCompleteness: score("starCompleteness"),
      atsFriendliness: score("atsFriendliness"),
      overallBefore: typeof scoresValue.overallBefore === "number"
        ? scoresValue.overallBefore
        : fallback.scores.overallBefore,
      overallAfter: typeof scoresValue.overallAfter === "number"
        ? scoresValue.overallAfter
        : fallback.scores.overallAfter,
      label: typeof scoresValue.label === "string" ? scoresValue.label : fallback.scores.label,
      keywordAnalysis: {
        jdKeywords: isStringArray(keywordValue.jdKeywords) ? keywordValue.jdKeywords : keywordFallback.jdKeywords,
        matched: isStringArray(keywordValue.matched) ? keywordValue.matched : keywordFallback.matched,
        missing: isStringArray(keywordValue.missing) ? keywordValue.missing : keywordFallback.missing,
        newlyCovered: isStringArray(keywordValue.newlyCovered) ? keywordValue.newlyCovered : keywordFallback.newlyCovered,
        stillMissing: isStringArray(keywordValue.stillMissing) ? keywordValue.stillMissing : keywordFallback.stillMissing,
      },
      strengths: isStringArray(scoresValue.strengths) ? scoresValue.strengths : fallback.scores.strengths,
      weaknesses: isStringArray(scoresValue.weaknesses) ? scoresValue.weaknesses : fallback.scores.weaknesses,
      actionItems: isStringArray(scoresValue.actionItems) ? scoresValue.actionItems : fallback.scores.actionItems,
    },
    resume: {
      basics: { ...fallback.resume.basics, ...basicsValue },
      summary: { ...fallback.resume.summary, ...summaryValue },
      sections: normalizedSections,
      skills: normalizedSkills,
    },
    rewrittenResumeMarkdown:
      typeof value.rewrittenResumeMarkdown === "string" && value.rewrittenResumeMarkdown.trim()
        ? value.rewrittenResumeMarkdown
        : fallback.rewrittenResumeMarkdown,
    modifications: normalizedModifications,
  } as RewriteResult

  return sanitizeRewriteResult(normalized)
}

export async function runAgentPipeline(
  jd: string,
  resume: string,
  emit: StreamEventEmitter,
): Promise<AgentAnalysisResult> {
  try {
    assertAiConfigured()
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI 未配置"
    emit({ type: "error", message, phase: "A" })
    throw error
  }

  let pipelineSource: ResultSource = "model"

  // 阶段 A
  let persona: PersonaResult
  try {
    persona = markSource(await streamJsonPhaseWithRetry(
      "A",
      PHASE_A_SYSTEM,
      buildPhaseAUserPrompt(jd),
      emit,
      parsePersona,
      ANALYSIS_STREAM_OPTIONS,
      2,
    ), "model")
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown error"
    if (isAiConfigError(error)) {
      emit({ type: "error", message: reason, phase: "A" })
      throw error
    }
    console.warn(`phase_A_fallback: ${reason}`)
    persona = getFallbackPersona()
    pipelineSource = "fallback"
  }
  emit({ type: "result", phase: "A", data: persona, source: persona.source ?? "model" })
  emit({ type: "phase", phase: "A", status: "complete" })

  // 阶段 B
  let outline: OutlineResult
  try {
    if (pipelineSource === "fallback" && persona.source === "fallback") {
      // A 已降级时 B/C 同步使用示例，避免半截真实数据混入示例画像
      throw new Error("upstream fallback")
    }
    outline = markSource(await streamJsonPhaseWithRetry(
      "B",
      PHASE_B_SYSTEM,
      buildPhaseBUserPrompt(jd, JSON.stringify(persona)),
      emit,
      parseOutline,
      ANALYSIS_STREAM_OPTIONS,
      2,
    ), "model")
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown error"
    if (isAiConfigError(error)) {
      emit({ type: "error", message: reason, phase: "B" })
      throw error
    }
    console.warn(`phase_B_fallback: ${reason}`)
    outline = getFallbackOutline()
    pipelineSource = "fallback"
  }
  emit({ type: "result", phase: "B", data: outline, source: outline.source ?? "model" })
  emit({ type: "phase", phase: "B", status: "complete" })

  // 阶段 C（需要简历；若为空则基于 JD 生成模板）
  const resumeInput =
    resume.trim() ||
    "（用户尚未提供简历，请基于理想大纲生成一份示例对齐简历，并在修改理由中说明这是模板生成。）"

  let rewrite: RewriteResult
  try {
    if (pipelineSource === "fallback") {
      throw new Error("upstream fallback")
    }
    rewrite = markSource(await streamJsonPhaseWithRetry(
      "C",
      PHASE_C_SYSTEM,
      buildPhaseCUserPrompt(jd, JSON.stringify(outline), resumeInput),
      emit,
      (text) => parseRewrite(text, resume, outline),
      ANALYSIS_STREAM_OPTIONS,
      1,
    ), "model")
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown error"
    if (isAiConfigError(error)) {
      emit({ type: "error", message: reason, phase: "C" })
      throw error
    }
    console.warn(`phase_C_fallback: ${reason}`)
    rewrite = getFallbackRewrite(resume, outline)
    pipelineSource = "fallback"
  }
  emit({ type: "result", phase: "C", data: rewrite, source: rewrite.source ?? "model" })
  emit({ type: "phase", phase: "C", status: "complete" })

  const result: AgentAnalysisResult = {
    persona,
    outline,
    rewrite,
    source: pipelineSource,
  }
  emit({ type: "done", data: result, source: pipelineSource })
  return result
}

export async function runInterviewPipeline(
  jd: string,
  context: InterviewContext,
  emit: StreamEventEmitter,
): Promise<InterviewResult> {
  try {
    assertAiConfigured()
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI 未配置"
    emit({ type: "error", message, phase: "D" })
    throw error
  }

  let metrics: StreamMetrics | undefined
  let interview: InterviewResult
  let source: ResultSource = "model"

  try {
    const phaseDText = await streamPhaseWithRetry(
      "D",
      PHASE_D_SYSTEM,
      buildPhaseDUserPrompt(jd, context),
      emit,
      {
        publishContent: false,
        // 最多 5 题 × ~400 字示范话术，预留结构字段空间
        maxCompletionTokens: 5200,
        jsonMode: true,
        temperature: 0.2,
        timeoutMs: 60_000,
        onMetrics: (value) => {
          metrics = value
        },
      },
    )
    interview = markSource(parseInterviewResult(phaseDText), "model")
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown error"
    if (isAiConfigError(error)) {
      emit({ type: "error", message: reason, phase: "D" })
      throw error
    }
    console.warn(`interview_prediction_fallback: ${reason}`)
    interview = buildFallbackInterview(context, jd)
    source = "fallback"
  }

  console.info("interview_prediction_completed", JSON.stringify({
    model: getModel(),
    jdChars: jd.length,
    contextChars: JSON.stringify(context).length,
    firstTokenMs: metrics?.firstTokenMs,
    totalMs: metrics?.totalMs,
    outputChars: metrics?.outputChars,
    finishReason: metrics?.finishReason,
    source,
  }))
  emit({ type: "result", phase: "D", data: interview, source })
  emit({ type: "phase", phase: "D", status: "complete" })
  emit({ type: "interview_done", data: interview, source })

  return interview
}
