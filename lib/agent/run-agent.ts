import { getModel, getOpenAIClient, shouldDisableThinking } from "@/lib/openai"
import { buildMarkdownFromRewrite } from "@/lib/pdf/resume-to-markdown"
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
import {
  PHASE_E_SYSTEM,
  PHASE_F_SYSTEM,
  buildPhaseEUserPrompt,
  buildPhaseFUserPrompt,
} from "@/lib/agent/prompts-gap"
import type { InterviewContext } from "@/lib/agent/interview-context"
import {
  parseEvidenceGapResult,
  parseEvidenceRefineResult,
  type EvidenceGapContext,
} from "@/lib/agent/evidence-gap"
import { buildFallbackInterview } from "@/lib/agent/interview-fallback"
import {
  getFallbackEvidenceGaps,
  getFallbackEvidenceRefine,
  getFallbackOutline,
  getFallbackPersona,
  getFallbackRewrite,
} from "@/lib/agent/fallback-content"
import { assertAiConfigured, isAiConfigError } from "@/lib/agent/ai-config"
import type {
  AgentAnalysisResult,
  AgentPhase,
  EvidenceAnswer,
  EvidenceGapResult,
  EvidencePhase,
  EvidenceRefineResult,
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

/** 阶段 F 与主流水线共用一次流式调用，但使用独立事件族 */
type StreamStage = AgentPhase | EvidencePhase

function isEvidenceStage(stage: StreamStage): stage is EvidencePhase {
  return stage === "F"
}


async function streamPhase(
  phase: StreamStage,
  system: string,
  user: string,
  emit: StreamEventEmitter,
  options: StreamPhaseOptions = {},
): Promise<string> {
  const openai = getOpenAIClient()
  const model = getModel()

  const startMessage =
    phase === "A"
      ? "正在深度解析职位描述…"
      : phase === "B"
        ? "正在逆向推导理想简历大纲…"
        : phase === "C"
          ? "正在定位缺失的匹配证据…"
          : phase === "D"
            ? "正在对比重写简历…"
            : phase === "E"
              ? "正在生成面试问题…"
              : "正在回填简历亮点…"
  if (isEvidenceStage(phase)) {
    emit({ type: "evidence_phase", phase, status: "start", message: startMessage })
  } else {
    emit({ type: "phase", phase: phase as AgentPhase, status: "start", message: startMessage })
  }

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
    if (options.publishContent !== false && !isEvidenceStage(phase)) {
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
  phase: StreamStage,
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

/** 阶段 D 输出体量最大（评分 + 结构化简历 + Markdown），需要足够的输出预算 */
const REWRITE_STREAM_OPTIONS: StreamPhaseOptions = {
  publishContent: false,
  jsonMode: true,
  maxCompletionTokens: 16000,
  temperature: 0.3,
  timeoutMs: 180_000,
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
      ...(defaultValue as Record<string, unknown>),
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

  const rawModelMarkdown =
    typeof value.rewrittenResumeMarkdown === "string" ? value.rewrittenResumeMarkdown.trim() : ""
  const modelMarkdown = rawModelMarkdown.includes("重写服务暂时不可用") ? "" : rawModelMarkdown

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
    rewrittenResumeMarkdown: modelMarkdown,
    modifications: normalizedModifications,
  } as RewriteResult

  // 模型偶尔会漏掉 rewrittenResumeMarkdown：用结构化数据自渲染，避免展示兜底占位文案
  if (!normalized.rewrittenResumeMarkdown.trim()) {
    const rendered = buildMarkdownFromRewrite(normalized)
    if (rendered.trim()) normalized.rewrittenResumeMarkdown = rendered
  }

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

  // 证据收集（阶段 E）与重写（阶段 C）延后到前端完成证据收集后再触发，
  // 这里只完成 A/B，把原始简历暂存到 done 事件里供后续阶段使用。
  const result: AgentAnalysisResult = {
    persona,
    outline,
    rewrite: null,
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
    emit({ type: "error", message, phase: "E" })
    throw error
  }

  let metrics: StreamMetrics | undefined
  let interview: InterviewResult
  let source: ResultSource = "model"

  try {
    const phaseDText = await streamPhaseWithRetry(
      "E",
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
      emit({ type: "error", message: reason, phase: "E" })
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
  emit({ type: "result", phase: "E", data: interview, source })
  emit({ type: "phase", phase: "E", status: "complete" })
  emit({ type: "interview_done", data: interview, source })

  return interview
}

/** 阶段 E：基于 JD 缺口与现有经历生成追问 */
export async function runEvidenceGapPipeline(
  jd: string,
  context: EvidenceGapContext,
  emit: StreamEventEmitter,
): Promise<EvidenceGapResult> {
  let result: EvidenceGapResult
  let source: ResultSource = "model"

  try {
    const phaseEText = await streamPhaseWithRetry(
      "C",
      PHASE_E_SYSTEM,
      buildPhaseEUserPrompt(jd, context),
      emit,
      {
        publishContent: false,
        // 3-6 条追问 + 字段，预留结构空间
        maxCompletionTokens: 2400,
        jsonMode: true,
        temperature: 0.3,
        timeoutMs: 60_000,
      },
    )
    result = markSource(parseEvidenceGapResult(phaseEText), "model")
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown error"
    console.warn(`evidence_gap_fallback: ${reason}`)
    result = { ...getFallbackEvidenceGaps(), source: "fallback" }
    source = "fallback"
  }

  const payload: EvidenceGapResult = { ...result, source }
  emit({ type: "evidence_gaps", data: payload, source })
  emit({ type: "phase", phase: "C", status: "complete" })

  return payload
}

/** 阶段 F：把用户回答回填为简历亮点并更新受影响的维度分 */
export async function runEvidenceRefinePipeline(
  jd: string,
  context: EvidenceGapContext,
  answers: EvidenceAnswer[],
  emit: StreamEventEmitter,
): Promise<EvidenceRefineResult> {
  const effectiveAnswers = answers.filter(
    (answer) => !answer.skipped && answer.answer.trim().length > 0,
  )

  let result: EvidenceRefineResult
  let source: ResultSource = "model"

  try {
    if (effectiveAnswers.length === 0) {
      throw new Error("没有有效回答")
    }

    const phaseFText = await streamPhaseWithRetry(
      "F",
      PHASE_F_SYSTEM,
      buildPhaseFUserPrompt(jd, context, effectiveAnswers),
      emit,
      {
        publishContent: false,
        maxCompletionTokens: 2800,
        jsonMode: true,
        temperature: 0.2,
        timeoutMs: 60_000,
      },
    )
    result = markSource(parseEvidenceRefineResult(phaseFText), "model")
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown error"
    console.warn(`evidence_refine_fallback: ${reason}`)
    result = { ...getFallbackEvidenceRefine(), source: "fallback" }
    source = "fallback"
  }

  const payload: EvidenceRefineResult = { ...result, source }
  emit({ type: "evidence_refined", data: payload, source })
  emit({ type: "evidence_phase", phase: "F", status: "complete" })

  return payload
}


/** 阶段 D：基于 JD、大纲、原始简历与用户补充的证据重写简历并评分 */
export async function runRewritePipeline(
  jd: string,
  persona: PersonaResult,
  outline: OutlineResult,
  resume: string,
  evidence: string,
  emit: StreamEventEmitter,
): Promise<RewriteResult> {
  const resumeInput =
    resume.trim() ||
    "（用户尚未提供简历，请基于理想大纲生成一份示例对齐简历，并在修改理由中说明这是模板生成。）"

  let rewrite: RewriteResult
  let source: ResultSource = "model"

  try {
    rewrite = markSource(await streamJsonPhaseWithRetry(
      "D",
      PHASE_C_SYSTEM,
      buildPhaseCUserPrompt(jd, JSON.stringify(outline), resumeInput, evidence),
      emit,
      (text) => parseRewrite(text, resume, outline),
      REWRITE_STREAM_OPTIONS,
      2,
    ), "model")
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown error"
    if (isAiConfigError(error)) {
      emit({ type: "error", message: reason, phase: "D" })
      throw error
    }
    console.warn(`phase_C_fallback: ${reason}`)
    rewrite = getFallbackRewrite(resume, outline)
    source = "fallback"
  }

  const payload: RewriteResult = { ...rewrite, source: rewrite.source ?? source }
  emit({ type: "result", phase: "D", data: payload, source })
  emit({ type: "phase", phase: "D", status: "complete" })

  return payload
}
