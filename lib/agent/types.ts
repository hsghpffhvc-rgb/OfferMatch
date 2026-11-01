export type AgentPhase = "A" | "B" | "C" | "D"

export type PhaseStatus = "start" | "streaming" | "complete" | "error"

/** 结果来源：模型正常产出 / 降级示例 */
export type ResultSource = "model" | "fallback"

/** 阶段 A：理想候选人画像 */
export interface PersonaResult {
  title: string
  industry: string
  hardSkills: string[]
  softSkills: string[]
  businessPainPoints: string[]
  interviewKeywords: string[]
  optimizationAdvice: string[]
  source?: ResultSource
}

/** 阶段 B：理想简历大纲 */
export interface ResumeOutlineSection {
  heading: string
  bullets: string[]
}

export interface OutlineResult {
  summary: string
  sections: ResumeOutlineSection[]
  keyHighlights: string[]
  source?: ResultSource
}

export type DimensionKey =
  | "keywordCoverage"
  | "hardSkillMatch"
  | "softSkillMatch"
  | "experienceRelevance"
  | "quantification"
  | "starCompleteness"
  | "atsFriendliness"

export interface DimensionMeta {
  key: DimensionKey
  name: string
  weight: number
  color: string
  description: string
}

export interface DimensionScore {
  before: number
  after: number
  gaps: string[]
  improvements: string[]
}

export interface KeywordAnalysis {
  jdKeywords: string[]
  matched: string[]
  missing: string[]
  newlyCovered: string[]
  stillMissing: string[]
}

export const DIMENSIONS: DimensionMeta[] = [
  {
    key: "keywordCoverage",
    name: "关键词覆盖",
    weight: 0.2,
    color: "#A18AFF",
    description: "JD 能力/业务关键词与简历覆盖程度（不含地点福利）",
  },
  {
    key: "hardSkillMatch",
    name: "硬技能匹配",
    weight: 0.2,
    color: "#7C6FF0",
    description: "技术栈、工具、方法论与岗位要求的匹配度",
  },
  {
    key: "softSkillMatch",
    name: "软技能匹配",
    weight: 0.1,
    color: "#8D77FF",
    description: "沟通、协作、推进、影响力等能力的表达质量",
  },
  {
    key: "experienceRelevance",
    name: "经历相关性",
    weight: 0.2,
    color: "#B38CFF",
    description: "项目/工作经历与目标岗位的贴合程度",
  },
  {
    key: "quantification",
    name: "量化表达",
    weight: 0.1,
    color: "#6D7CFF",
    description: "成果是否具备明确的数据、范围、结果与影响",
  },
  {
    key: "starCompleteness",
    name: "STAR 完整度",
    weight: 0.1,
    color: "#9E8BFF",
    description: "情境、任务、行动、结果四要素是否完整",
  },
  {
    key: "atsFriendliness",
    name: "ATS 友好度",
    weight: 0.1,
    color: "#5F8CFF",
    description: "是否利于解析、检索与机器筛选",
  },
]

export interface MatchScores {
  keywordCoverage: DimensionScore
  hardSkillMatch: DimensionScore
  softSkillMatch: DimensionScore
  experienceRelevance: DimensionScore
  quantification: DimensionScore
  starCompleteness: DimensionScore
  atsFriendliness: DimensionScore
  overallBefore: number
  overallAfter: number
  label: string
  keywordAnalysis: KeywordAnalysis
  strengths: string[]
  weaknesses: string[]
  actionItems: string[]
}

export function calculateOverall(scores: MatchScores, useBefore: boolean): number {
  const totalWeight = DIMENSIONS.reduce((sum, dimension) => sum + dimension.weight, 0)
  const weightedTotal = DIMENSIONS.reduce((sum, dimension) => {
    const value = scores[dimension.key][useBefore ? "before" : "after"]
    return sum + value * dimension.weight
  }, 0)

  if (totalWeight === 0) return 0
  return Math.round(weightedTotal / totalWeight)
}

/** 阶段 C：差异化重写 */
export interface ModificationItem {
  section: string
  original: string
  rewritten: string
  rationale: string
  matchedKeywords: string[]
}

/**
 * 阶段 C 的可渲染简历数据。Markdown 仅用于界面展示，PDF 必须只消费此对象。
 */
export interface StructuredResumeHighlight {
  title?: string
  action: string
  metric: string
  result: string
}

export interface StructuredResumeItem {
  role?: string
  company?: string
  location?: string
  date?: { start?: string; end?: string }
  summary?: string
  highlights?: StructuredResumeHighlight[]
  keywords?: string[]
  order?: number
  name?: string
  title?: string
  subtitle?: string
  school?: string
  degree?: string
  major?: string
  gpa?: string
  notes?: string
  level?: string
}

export interface StructuredResumeSection {
  type: string
  title: string
  items: StructuredResumeItem[]
}

export interface StructuredResumeSkill {
  name: string
  category: string
  level: string
  evidence: string
}

export interface StructuredResume {
  basics: {
    name: string
    title: string
    email: string
    phone: string
    location: string
    linkedin: string
    github: string
    website: string
    photo: string
  }
  summary: { text: string; positioning: string; yearsExperience: number; keywords: string[] }
  sections: StructuredResumeSection[]
  skills: Array<{ group: string; items: StructuredResumeSkill[] }>
}

export interface RewriteResult {
  scores: MatchScores
  resume: StructuredResume
  rewrittenResumeMarkdown: string
  modifications: ModificationItem[]
  source?: ResultSource
}

export interface AgentAnalysisResult {
  persona: PersonaResult
  outline: OutlineResult
  /** 证据收集完成并重写后才有；A/B 阶段完成时为 null */
  rewrite: RewriteResult | null
  source?: ResultSource
}

export interface ChatRequestBody {
  jd: string
  resume: string
}

/* ------------------------------------------------------------------ */
/* 阶段 E / F：JD 缺失证据追问与回填                                     */
/* 独立于 AgentPhase（A-D），避免影响既有 reasoningByPhase 字面量         */
/* ------------------------------------------------------------------ */

export type EvidencePhase = "E" | "F"

/** 缺口严重度：critical 直接影响过筛，optional 属于加分项 */
export type GapSeverity = "critical" | "important" | "optional"

/** 追问类型，决定回答提示的写法 */
export type GapQuestionType =
  | "experience" // 是否真做过这类事
  | "metric"     // 结果数字
  | "scope"      // 范围与规模
  | "method"     // 具体做法
  | "outcome"    // 最终影响

/** 单条证据缺口 + 追问 */
export interface EvidenceGap {
  id: string
  dimension: DimensionKey
  /** 对应的 JD 能力关键词 */
  keyword: string
  /** JD 原文要求（≤40 字） */
  jdRequirement: string
  /** 为什么判定为缺失（一句，引用简历现状） */
  whyMissing: string
  /** 面向用户的追问（≤60 字，必须具体到项目/动作/数字） */
  question: string
  questionType: GapQuestionType
  /** 2-3 条回答提示 */
  answerHints: string[]
  severity: GapSeverity
  /** 建议补进简历的章节 type */
  relatedSection?: string
  /** 从简历摘录的原文锚点；完全没有相关经历时留空 */
  resumeAnchor?: string
}

export interface EvidenceGapResult {
  gaps: EvidenceGap[]
  coachingNote: string
  source?: ResultSource
}

/** 用户对某条缺口的回答 */
export interface EvidenceAnswer {
  gapId: string
  keyword: string
  answer: string
  /** 原始追问，回填时用于 grounding（可选，避免模型脱题） */
  question?: string
  skipped?: boolean
}

/** 回填补丁：把一条回答转成结构化 highlight */
export interface EvidencePatch {
  gapId: string
  /** experience | projects | education | awards | languages */
  sectionType: string
  /** 目标条目的 order（上下文里给出）；找不到时省略 */
  itemOrder?: number
  highlight: StructuredResumeHighlight
  matchedKeywords: string[]
  /** 回答的可信度，low 时前端标「待确认」 */
  confidence: "high" | "medium" | "low"
  needsMoreInfo: boolean
  followUpQuestion?: string
}

/** 项目复盘要点，供阶段 D 复用 */
export interface ProjectRetroItem {
  project: string
  strength: string
  missingMetric: string
  nextProbe: string
}

export interface EvidenceRefineResult {
  patches: EvidencePatch[]
  /** 仅受影响维度的新 after 分；总分由前端 calculateOverall 重算 */
  dimensionScores: Partial<Record<DimensionKey, number>>
  keywordAnalysis: KeywordAnalysis
  projectRetro: ProjectRetroItem[]
  source?: ResultSource
}

export interface EvidenceGapRequestBody {
  action: "ask" | "refine"
  jd: string
  persona?: PersonaResult
  rewrite?: RewriteResult
  /** 前置证据收集阶段使用：原始简历文本 */
  resume?: string
  answers?: EvidenceAnswer[]
}

/** SSE 事件类型 */
export type StreamEvent =
  | { type: "phase"; phase: AgentPhase; status: PhaseStatus; message?: string }
  | { type: "reasoning"; phase: AgentPhase; content: string }
  | {
      type: "result"
      phase: AgentPhase
      data: PersonaResult | OutlineResult | RewriteResult | InterviewResult
      source?: ResultSource
    }
  | { type: "done"; data: AgentAnalysisResult; source?: ResultSource }
  | { type: "interview_done"; data: InterviewResult; source?: ResultSource }
  | { type: "evidence_phase"; phase: EvidencePhase; status: PhaseStatus; message?: string }
  | { type: "evidence_gaps"; data: EvidenceGapResult; source?: ResultSource }
  | { type: "evidence_refined"; data: EvidenceRefineResult; source?: ResultSource }
  | { type: "error"; message: string; phase?: AgentPhase }

export type StreamEventEmitter = (event: StreamEvent) => void

/** 面试题分类 */
export type InterviewCategory =
  | "resume_deep_dive"   // 简历深挖
  | "technical"          // 技术/专业
  | "behavioral"         // 行为面试
  | "job_fit"            // 岗位匹配
  | "motivation"         // 动机/文化

/** 面试题难度 */
export type InterviewDifficulty = "easy" | "medium" | "hard"

/** 单道面试题（精简字段，强调可背诵的示范话术） */
export interface InterviewQuestion {
  id: string
  category: InterviewCategory
  difficulty: InterviewDifficulty
  question: string                     // ≤60字
  intent: string                       // ≤50字
  referenceAnswer: string              // 核心：300-400字完整示范话术
  answerStrategy: string               // STAR 三句话方向，每句≤25字
  personalizedBridge: string           // 「用你【公司|职位】的XX经历替换…」
}

/** 阶段 D：模拟面试结果 */
export interface InterviewResult {
  questions: InterviewQuestion[]       // 3-5道题
  preparationChecklist: string[]       // 轻量：3条×约20字
  source?: ResultSource
}

/** 面试请求体 */
export interface InterviewRequestBody {
  jd: string
  context: import("@/lib/agent/interview-context").InterviewContext
}
