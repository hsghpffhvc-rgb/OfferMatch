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
  rewrite: RewriteResult
  source?: ResultSource
}

export interface ChatRequestBody {
  jd: string
  resume: string
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
