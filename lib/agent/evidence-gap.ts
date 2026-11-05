import { sanitizeKeywordAnalysis } from "@/lib/agent/keyword-filter"
import { extractJsonFromText } from "@/lib/agent/parse-json"
import {
  DIMENSIONS,
  calculateOverall,
  type DimensionKey,
  type EvidenceGap,
  type EvidenceGapResult,
  type EvidencePatch,
  type EvidenceRefineResult,
  type KeywordAnalysis,
  type MatchScores,
  type PersonaResult,
  type ProjectRetroItem,
  type RewriteResult,
  type StructuredResumeHighlight,
} from "@/lib/agent/types"

const MAX_TEXT_LENGTH = 220
const MAX_HIGHLIGHTS_PER_ITEM = 8
const MAX_KEYWORDS_PER_ITEM = 12
/** 单轮追问允许的维度分提升上限 */
const MAX_DIMENSION_GAIN = 12

const SECTION_TYPES = ["experience", "projects", "education", "awards", "languages"] as const

const DIMENSION_KEYS: DimensionKey[] = DIMENSIONS.map((dimension) => dimension.key)

const EMPTY_KEYWORD_ANALYSIS: KeywordAnalysis = {
  jdKeywords: [],
  matched: [],
  missing: [],
  newlyCovered: [],
  stillMissing: [],
}

/** 单条可被追问的经历（含定位信息，便于阶段 F 精确回填） */
export interface EvidenceGapExperience {
  sectionType: string
  itemOrder: number
  label: string
  summary: string
  highlights: string[]
}

/** 阶段 E / F 共用紧凑上下文，不传完整 Markdown 与修改记录 */
export interface EvidenceGapContext {
  targetTitle: string
  missingKeywords: string[]
  dimensions: Array<{ key: DimensionKey; name: string; after: number; gaps: string[] }>
  experiences: EvidenceGapExperience[]
  skills: string[]
}

function compactText(value: string | undefined, max = MAX_TEXT_LENGTH): string {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, max)
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(100, Math.max(0, Math.round(value)))
}

/** 与阶段 C 的 label 区间保持一致 */
/** 把用户的证据问答序列化为阶段 D 的上下文文本（面板与重试入口共用） */
export function buildEvidenceTextFromState(params: {
  gaps: EvidenceGap[]
  answers: Record<string, string>
  skippedGapIds?: string[]
}): string {
  const skipped = params.skippedGapIds ?? []
  const lines: string[] = ["【用户补充的证据】"]
  for (const gap of params.gaps) {
    const answer = (params.answers[gap.id] ?? "").trim()
    lines.push(`- 追问：${gap.question}（关键词：${gap.keyword}）`)
    if (skipped.includes(gap.id) || !answer) {
      lines.push("  回答：无相关经历/数据（该缺口仅放入分析，不写进简历正文，不得编造）")
    } else {
      lines.push(`  回答：${answer}`)
    }
  }
  return lines.join("\n")
}

export function resolveMatchLabel(overallAfter: number): string {
  if (overallAfter >= 85) return "高度匹配"
  if (overallAfter >= 71) return "较匹配"
  if (overallAfter >= 60) return "基本匹配"
  return "待提升"
}

/** 缺口候选数量：决定是否值得自动发起追问 */
export function countGapCandidates(rewrite: RewriteResult | null): number {
  const analysis = rewrite?.scores?.keywordAnalysis
  if (!analysis) return 0
  return new Set([...analysis.missing, ...analysis.stillMissing]).size
}

export function buildEvidenceGapContext(
  persona: PersonaResult,
  resume: string,
  rewrite?: RewriteResult | null,
): EvidenceGapContext {
  // 前置证据收集：还没有 rewrite，基于原始简历文本构建最小上下文
  if (!rewrite) {
    const compactResume = compactText(resume, 1200)
    return {
      targetTitle: compactText(persona.title, 80),
      missingKeywords: persona.interviewKeywords
        .map((item) => compactText(item, 40))
        .filter(Boolean)
        .slice(0, 10),
      dimensions: [],
      experiences: compactResume
        ? [{ sectionType: "experience", itemOrder: 1, label: "原始简历", summary: compactResume, highlights: [] }]
        : [],
      skills: persona.hardSkills.map((item) => compactText(item, 40)).filter(Boolean).slice(0, 10),
    }
  }
  const analysis = rewrite.scores?.keywordAnalysis ?? EMPTY_KEYWORD_ANALYSIS

  const missingKeywords = Array.from(
    new Set([...analysis.stillMissing, ...analysis.missing]),
  )
    .map((item) => compactText(item, 40))
    .filter(Boolean)
    .slice(0, 10)

  const dimensions = DIMENSIONS.map((meta) => {
    const score = rewrite.scores?.[meta.key]
    return {
      key: meta.key,
      name: meta.name,
      after: score?.after ?? 0,
      gaps: (score?.gaps ?? []).map((item) => compactText(item, 80)).filter(Boolean).slice(0, 2),
    }
  })

  const experiences: EvidenceGapExperience[] = rewrite.resume.sections
    .filter((section) =>
      /项目|工作|实习|经历|project|experience|intern/i.test(`${section.type} ${section.title}`),
    )
    .flatMap((section) =>
      section.items.map((item, index) => {
        const itemLabel = item.name ?? item.title ?? item.role ?? item.company
        return {
          sectionType: compactText(section.type, 24) || "experience",
          itemOrder: typeof item.order === "number" ? item.order : index + 1,
          label: compactText(itemLabel, 80) || "相关经历",
          summary: compactText(item.summary),
          highlights: (item.highlights ?? [])
            .map((highlight) =>
              compactText(
                [highlight.title, highlight.action, highlight.metric, highlight.result]
                  .filter(Boolean)
                  .join("；"),
                120,
              ),
            )
            .filter(Boolean)
            .slice(0, 3),
        }
      }),
    )
    .slice(0, 5)

  const skills = rewrite.resume.skills
    .flatMap((group) => group.items)
    .map((skill) => compactText(skill.name, 40))
    .filter(Boolean)
    .slice(0, 10)

  return {
    targetTitle: compactText(persona.title, 80),
    missingKeywords,
    dimensions,
    experiences,
    skills,
  }
}

export interface ApplyEvidenceResult {
  rewrite: RewriteResult
  applied: EvidencePatch[]
  skipped: EvidencePatch[]
}

function normalizeHighlight(highlight: StructuredResumeHighlight): string {
  return `${highlight.action ?? ""}${highlight.metric ?? ""}${highlight.result ?? ""}`
    .replace(/\s+/g, "")
    .toLowerCase()
}

function mergeKeywords(existing: string[] | undefined, incoming: string[]): string[] {
  const merged: string[] = []
  for (const item of [...(existing ?? []), ...incoming]) {
    const text = compactText(item, 30)
    if (!text) continue
    if (merged.includes(text)) continue
    merged.push(text)
    if (merged.length >= MAX_KEYWORDS_PER_ITEM) break
  }
  return merged
}

/**
 * 把阶段 F 的补丁合并进简历，并重算总分与 label。
 * 总分统一走 calculateOverall，避免与维度权重脱节。
 */
export function applyEvidencePatches(
  rewrite: RewriteResult,
  result: EvidenceRefineResult,
): ApplyEvidenceResult {
  const sections = rewrite.resume.sections.map((section) => ({
    ...section,
    items: section.items.map((item) => ({
      ...item,
      highlights: [...(item.highlights ?? [])],
      keywords: [...(item.keywords ?? [])],
    })),
  }))

  const applied: EvidencePatch[] = []
  const skipped: EvidencePatch[] = []

  for (const patch of result.patches ?? []) {
    const highlight = patch.highlight
    const hasContent = Boolean(
      compactText(highlight?.action) || compactText(highlight?.result),
    )
    if (!hasContent) {
      skipped.push(patch)
      continue
    }

    const wantedType = (patch.sectionType ?? "").toLowerCase()
    let section =
      sections.find((item) => item.type.toLowerCase() === wantedType)
      ?? sections.find((item) => item.type.toLowerCase().includes(wantedType) && wantedType.length > 0)
      ?? sections.find((item) =>
        /项目|工作|实习|经历|project|experience|intern/i.test(`${item.type} ${item.title}`),
      )
      ?? sections[0]

    if (!section) {
      section = { type: "projects", title: "项目经历", items: [] }
      sections.push(section)
    }

    if (section.items.length === 0) {
      section.items.push({ order: 1, highlights: [], keywords: [] })
    }

    const targetItem =
      section.items.find((item) => item.order === patch.itemOrder) ?? section.items[0]

    const nextHighlight: StructuredResumeHighlight = {
      title: compactText(highlight.title, 12) || compactText(highlight.action, 12),
      action: compactText(highlight.action, 120),
      metric: compactText(highlight.metric, 60),
      result: compactText(highlight.result, 120),
    }

    const signature = normalizeHighlight(nextHighlight)
    const duplicated = (targetItem.highlights ?? []).some(
      (item) => normalizeHighlight(item) === signature,
    )

    if (duplicated) {
      skipped.push(patch)
      continue
    }

    targetItem.highlights = [...(targetItem.highlights ?? []), nextHighlight].slice(
      0,
      MAX_HIGHLIGHTS_PER_ITEM,
    )
    targetItem.keywords = mergeKeywords(targetItem.keywords, patch.matchedKeywords ?? [])
    applied.push(patch)
  }

  const nextScores: MatchScores = { ...rewrite.scores }

  if (applied.length > 0) {
    for (const key of DIMENSION_KEYS) {
      const nextValue = result.dimensionScores?.[key]
      if (typeof nextValue !== "number") continue
      const currentAfter = nextScores[key].after
      // 单轮提升封顶 +12，避免一次回答把分数抬得不可信
      const capped = Math.min(clampScore(nextValue), Math.min(100, currentAfter + MAX_DIMENSION_GAIN))
      nextScores[key] = {
        ...nextScores[key],
        after: Math.max(currentAfter, capped),
      }
    }
  }

  const keywordAnalysis = sanitizeKeywordAnalysis(
    result.keywordAnalysis ?? rewrite.scores?.keywordAnalysis ?? EMPTY_KEYWORD_ANALYSIS,
  )

  const overallAfter = calculateOverall(nextScores, false)

  return {
    rewrite: {
      ...rewrite,
      resume: { ...rewrite.resume, sections },
      scores: {
        ...nextScores,
        keywordAnalysis,
        overallAfter,
        label: resolveMatchLabel(overallAfter),
      },
    },
    applied,
    skipped,
  }
}

/* ------------------------------------------------------------------ */
/* 解析：模型输出校验（宽松降级，字段缺失时补默认值）                     */
/* ------------------------------------------------------------------ */

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null
}

function asString(value: unknown, max = 200): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : ""
}

function asStringArray(value: unknown, limit = 6, itemMax = 60): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => asString(item, itemMax))
    .filter(Boolean)
    .slice(0, limit)
}

function pickDimension(value: unknown): DimensionKey {
  const text = asString(value, 40)
  return (DIMENSION_KEYS as string[]).includes(text) ? (text as DimensionKey) : "keywordCoverage"
}

function pickSectionType(value: unknown): string {
  const text = asString(value, 24).toLowerCase()
  return (SECTION_TYPES as readonly string[]).includes(text) ? text : "experience"
}

function pickSeverity(value: unknown): EvidenceGap["severity"] {
  const text = asString(value, 16)
  return text === "critical" || text === "important" || text === "optional" ? text : "important"
}

function pickQuestionType(value: unknown): EvidenceGap["questionType"] {
  const text = asString(value, 16)
  const allowed: EvidenceGap["questionType"][] = [
    "experience",
    "metric",
    "scope",
    "method",
    "outcome",
  ]
  return allowed.includes(text as EvidenceGap["questionType"])
    ? (text as EvidenceGap["questionType"])
    : "experience"
}

function pickConfidence(value: unknown): EvidencePatch["confidence"] {
  const text = asString(value, 12)
  return text === "high" || text === "medium" || text === "low" ? text : "medium"
}

export function parseEvidenceGapResult(text: string): EvidenceGapResult {
  const raw = extractJsonFromText<unknown>(text)
  const root = asRecord(raw)
  if (!root || !Array.isArray(root.gaps)) {
    throw new Error("AI 追问结果缺少 gaps 列表")
  }

  const gaps: EvidenceGap[] = root.gaps
    .map((item, index): EvidenceGap | null => {
      const record = asRecord(item)
      if (!record) return null
      const question = asString(record.question, 80)
      if (!question) return null
      return {
        id: asString(record.id, 32) || `gap-${index + 1}`,
        dimension: pickDimension(record.dimension),
        keyword: asString(record.keyword, 40),
        jdRequirement: asString(record.jdRequirement, 60),
        whyMissing: asString(record.whyMissing, 100),
        question,
        questionType: pickQuestionType(record.questionType),
        answerHints: asStringArray(record.answerHints, 3, 24),
        severity: pickSeverity(record.severity),
        relatedSection: pickSectionType(record.relatedSection),
        resumeAnchor: asString(record.resumeAnchor, 60),
      }
    })
    .filter((item): item is EvidenceGap => item !== null)
    .slice(0, 6)

  if (gaps.length === 0) {
    throw new Error("AI 追问结果没有有效问题")
  }

  return {
    gaps,
    coachingNote: asString(root.coachingNote, 80),
  }
}

function parseHighlight(value: unknown): StructuredResumeHighlight {
  const record = asRecord(value) ?? {}
  return {
    title: asString(record.title, 12),
    action: asString(record.action, 120),
    metric: asString(record.metric, 60),
    result: asString(record.result, 120),
  }
}

export function parseEvidenceRefineResult(text: string): EvidenceRefineResult {
  const raw = extractJsonFromText<unknown>(text)
  const root = asRecord(raw)
  if (!root || !Array.isArray(root.patches)) {
    throw new Error("AI 回填结果缺少 patches 列表")
  }

  const patches: EvidencePatch[] = root.patches
    .map((item, index): EvidencePatch | null => {
      const record = asRecord(item)
      if (!record) return null
      const highlight = parseHighlight(record.highlight)
      if (!highlight.action && !highlight.result) return null
      return {
        gapId: asString(record.gapId, 32) || `gap-${index + 1}`,
        sectionType: pickSectionType(record.sectionType),
        itemOrder:
          typeof record.itemOrder === "number" && Number.isFinite(record.itemOrder)
            ? record.itemOrder
            : undefined,
        highlight,
        matchedKeywords: asStringArray(record.matchedKeywords, 3, 30),
        confidence: pickConfidence(record.confidence),
        needsMoreInfo: record.needsMoreInfo === true,
        followUpQuestion: asString(record.followUpQuestion, 80) || undefined,
      }
    })
    .filter((item): item is EvidencePatch => item !== null)
    .slice(0, 6)

  const dimensionScores: Partial<Record<DimensionKey, number>> = {}
  const rawScores = asRecord(root.dimensionScores)
  if (rawScores) {
    for (const key of DIMENSION_KEYS) {
      const value = rawScores[key]
      if (typeof value === "number" && Number.isFinite(value)) {
        dimensionScores[key] = clampScore(value)
      }
    }
  }

  const rawKeywordAnalysis = asRecord(root.keywordAnalysis)
  const keywordAnalysis: KeywordAnalysis = sanitizeKeywordAnalysis({
    jdKeywords: asStringArray(rawKeywordAnalysis?.jdKeywords, 8, 30),
    matched: asStringArray(rawKeywordAnalysis?.matched, 8, 30),
    missing: asStringArray(rawKeywordAnalysis?.missing, 8, 30),
    newlyCovered: asStringArray(rawKeywordAnalysis?.newlyCovered, 8, 30),
    stillMissing: asStringArray(rawKeywordAnalysis?.stillMissing, 8, 30),
  })

  const projectRetro: ProjectRetroItem[] = Array.isArray(root.projectRetro)
    ? root.projectRetro
        .map((item) => {
          const record = asRecord(item)
          if (!record) return null
          const project = asString(record.project, 40)
          if (!project) return null
          return {
            project,
            strength: asString(record.strength, 40),
            missingMetric: asString(record.missingMetric, 40),
            nextProbe: asString(record.nextProbe, 50),
          }
        })
        .filter((item): item is ProjectRetroItem => item !== null)
        .slice(0, 6)
    : []

  return { patches, dimensionScores, keywordAnalysis, projectRetro }
}
