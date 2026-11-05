import type {
  ResumeSnapshot,
  StructuredResume,
  StructuredResumeItem,
  StructuredResumeSection,
} from "@/lib/agent/types"

/**
 * 原始简历的「结构地图」：模块归属 + 每个条目的身份。
 *
 * 为什么需要它：
 * 阶段 A 已经把原文梳理成结构化快照，但改写阶段只拿到原文文本，
 * 于是模型会自行重新划分模块（把实习并进全职岗位、把工作职责再写一遍到项目经历）。
 * 这里把「原文有几个模块、每个模块有哪几条、哪几条是实习」显式传给改写阶段，
 * 并在改写结果上做确定性边界检查。
 */

export type SourceSectionKind =
  | "experience"
  | "projects"
  | "education"
  | "skills"
  | "awards"
  | "languages"
  | "summary"
  | "other"

export interface SourceSectionItem {
  /** 条目主名称：岗位 / 项目 / 学校 */
  label: string
  /** 二级信息：单位 / 角色 / 专业 */
  meta: string
  /** 原文时间写法 */
  date: string
  /** 是否实习 / 兼职经历 */
  internship: boolean
}

export interface SourceSectionEntry {
  kind: SourceSectionKind
  /** 原文模块名，保留「实习经历」这类独立模块名 */
  title: string
  items: SourceSectionItem[]
}

export interface SourceSectionIndex {
  sections: SourceSectionEntry[]
  /** 原文是否包含实习经历 */
  hasInternship: boolean
  /** 原文中实习条目的名称，用于判断输出是否把它丢掉 */
  internshipLabels: string[]
  /** 原文是否把实习写成独立模块 */
  internshipAsOwnSection: boolean
  origin: "snapshot" | "text"
}

const KIND_PATTERNS: Array<{ kind: SourceSectionKind; pattern: RegExp }> = [
  { kind: "projects", pattern: /项目|project/i },
  { kind: "education", pattern: /教育|学历|education/i },
  { kind: "skills", pattern: /技能|技术栈|skill/i },
  { kind: "awards", pattern: /荣誉|奖项|获奖|award/i },
  { kind: "languages", pattern: /语言|language/i },
  { kind: "summary", pattern: /自我评价|个人总结|个人简介|summary/i },
  { kind: "experience", pattern: /工作|任职|职业|实习|经历|校园|校内|学生|社团|志愿|社会实践|experience|intern/i },
]

const INTERNSHIP_PATTERN = /实习|intern/i

const HEADING_PATTERN =
  /^(工作经历|工作经验|实习经历|实习经验|职业经历|任职经历|校园经历|校园实践|社会实践|志愿经历|志愿服务|社团经历|学生工作|项目经历|项目经验|核心项目|代表项目|主要项目|项目实践|教育背景|教育经历|专业技能|技能|技术栈|荣誉奖项|获奖情况|证书|语言能力|自我评价|个人总结)\s*[：:]?\s*$/

const BULLET_PATTERN = /^([-*•·–—]|\d+[.)、]|[（(]\d+[)）])/

function detectKind(title: string): SourceSectionKind {
  for (const entry of KIND_PATTERNS) {
    if (entry.pattern.test(title)) return entry.kind
  }
  return "other"
}

function cleanText(value: unknown, max = 120): string {
  if (typeof value !== "string") return ""
  return value.replace(/\s+/g, " ").trim().slice(0, max)
}

function snapshotToIndex(snapshot: ResumeSnapshot): SourceSectionIndex {
  const sections: SourceSectionEntry[] = []
  const internshipLabels: string[] = []
  let internshipAsOwnSection = false

  for (const section of snapshot.sections ?? []) {
    const title = cleanText(section?.title, 40)
    if (!title) continue
    const kind = detectKind(title)
    const titleIsInternship = INTERNSHIP_PATTERN.test(title)
    if (kind === "experience" && titleIsInternship) internshipAsOwnSection = true

    const items: SourceSectionItem[] = (section.items ?? [])
      .map((item) => {
        const label = cleanText(item?.label, 80)
        const meta = cleanText(item?.meta, 60)
        const internship = INTERNSHIP_PATTERN.test(`${title} ${label} ${meta}`)
        if (internship) internshipLabels.push(label || meta)
        return { label, meta, date: cleanText(item?.date, 40), internship }
      })
      .filter((item) => Boolean(item.label || item.meta))
      .slice(0, 12)

    sections.push({ kind, title, items })
  }

  return {
    sections,
    hasInternship: internshipLabels.length > 0,
    internshipLabels: internshipLabels.filter(Boolean),
    internshipAsOwnSection,
    origin: "snapshot",
  }
}

/** 阶段 A 快照缺失时的兜底：按原文模块标题切块，只为结构化约束提供最小信息 */
function textToIndex(resumeText: string): SourceSectionIndex {
  const lines = resumeText.replace(/\r\n/g, "\n").split("\n")
  const sections: SourceSectionEntry[] = []
  const internshipLabels: string[] = []
  let internshipAsOwnSection = false

  let current: SourceSectionEntry | null = null
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    if (HEADING_PATTERN.test(line)) {
      const title = line.replace(/[：:]\s*$/, "")
      current = { kind: detectKind(title), title, items: [] }
      if (current.kind === "experience" && INTERNSHIP_PATTERN.test(title)) {
        internshipAsOwnSection = true
      }
      sections.push(current)
      continue
    }

    if (!current || BULLET_PATTERN.test(line)) continue
    if (current.items.length >= 12) continue
    // 原文里每条经历的首行通常包含岗位 / 项目名，作为条目名用于身份核对
    const label = cleanText(line, 60)
    if (!label) continue
    const internship = INTERNSHIP_PATTERN.test(`${current.title} ${label}`)
    if (internship) internshipLabels.push(label)
    current.items.push({ label, meta: "", date: "", internship })
  }

  return {
    sections,
    hasInternship: internshipLabels.length > 0,
    internshipLabels: internshipLabels.filter(Boolean),
    internshipAsOwnSection,
    origin: "text",
  }
}

export function buildSourceSectionIndex(
  snapshot: ResumeSnapshot | undefined | null,
  resumeText: string,
): SourceSectionIndex | null {
  if (snapshot && Array.isArray(snapshot.sections) && snapshot.sections.length > 0) {
    return snapshotToIndex(snapshot)
  }
  if (resumeText?.trim()) return textToIndex(resumeText)
  return null
}

const KIND_LABEL: Record<SourceSectionKind, string> = {
  experience: "工作经历",
  projects: "项目经历",
  education: "教育背景",
  skills: "专业技能",
  awards: "荣誉奖项",
  languages: "语言能力",
  summary: "个人总结",
  other: "其他",
}

/** 渲染成提示词里的「结构索引」块：只给模块与条目身份，不给正文 */
export function renderSourceSectionIndex(index: SourceSectionIndex | null): string {
  if (!index || index.sections.length === 0) return ""

  const lines: string[] = []
  for (const section of index.sections) {
    if (section.kind === "skills" || section.kind === "summary" || section.kind === "other") continue
    const header = section.title || KIND_LABEL[section.kind]
    lines.push(index.origin === "snapshot" ? `- ${header}（快照 ${section.items.length} 条）` : `- ${header}（原文标题）`)
    if (index.origin === "snapshot") section.items.forEach((item, position) => {
      const meta = [item.label, item.meta, item.date].filter(Boolean).join("｜")
      const tag = item.internship ? "实习" : ""
      lines.push(`  ${position + 1}. ${meta || "（原文未给出名称）"}${tag ? `｜${tag}` : ""}`)
    })
  }

  if (lines.length === 0) return ""

  const notes: string[] = []
  if (index.hasInternship) {
    notes.push(
      "原文含实习经历：实习必须输出到独立的「实习经历」模块（type=experience，title=实习经历），不得写进「工作经历」",
    )
  }
  if (index.sections.some((section) => section.kind === "projects")) {
    notes.push("项目经历条目必须与上表一一对应，禁止把工作经历职责改写成项目条目")
  }

  return [
    "【原始简历结构索引】（辅助梳理；可能误判段落层级，若与原文不符以原文为准，不得将概括句当岗位）",
    ...lines,
    ...(notes.length ? ["", "结构约束：", ...notes.map((note) => `- ${note}`)] : []),
  ].join("\n")
}

/* ------------------------------------------------------------------ */
/* 输出侧的边界冲突检测                                                */
/* ------------------------------------------------------------------ */

export type BoundaryConflictCode =
  | "INTERNSHIP_MERGED"
  | "PROJECT_RESTATES_EXPERIENCE"
  | "ITEM_COUNT_MISMATCH"
  | "SOURCE_SECTION_MISSING"

/** Only assert headings explicitly present in the source, including inline headings. */
export function detectMissingNamedSections(resume: StructuredResume, source: string): BoundaryConflict[] {
  const pattern = /^(校园经历|校园实践|社会实践|志愿经历|志愿服务|社团经历|学生工作)\s*(?:[：:]|$)/
  const headings = new Set(source.replace(/\r\n?/g, "\n").split("\n")
    .map((line) => line.trim().replace(/^#{1,6}\s*/, "").match(pattern)?.[1])
    .filter((title): title is string => Boolean(title)))
  return [...headings].filter((title) => !(resume.sections ?? []).some((section) =>
    section.title?.trim() === title && Array.isArray(section.items) && section.items.length > 0,
  )).map((title) => ({
    code: "SOURCE_SECTION_MISSING" as const,
    severity: "error" as const,
    message: `原文含「${title}」，重写结果未保留该模块，请核对经历归属与内容完整性。`,
  }))
}

export interface BoundaryConflict {
  code: BoundaryConflictCode
  severity: "error" | "warning"
  message: string
}

const MIN_COMPARE_LENGTH = 24

function normalizeForCompare(text: string): string {
  return text.replace(/[\s\u3000-\u303f\uff00-\uffef\p{P}\p{S}]/gu, "").toLowerCase()
}

function bigrams(text: string): Set<string> {
  const result = new Set<string>()
  for (let index = 0; index < text.length - 1; index++) {
    result.add(text.slice(index, index + 2))
  }
  return result
}

/** 覆盖率相似度：交集 / 较短文本的 bigram 数，衡量「一段内容是否被另一段重新说了一遍」 */
function overlapRatio(a: string, b: string): number {
  if (a.length < MIN_COMPARE_LENGTH || b.length < MIN_COMPARE_LENGTH) return 0
  const setA = bigrams(a)
  const setB = bigrams(b)
  if (setA.size === 0 || setB.size === 0) return 0
  let shared = 0
  for (const gram of setA) {
    if (setB.has(gram)) shared++
  }
  return shared / Math.min(setA.size, setB.size)
}

function itemText(item: StructuredResumeItem): string {
  const parts = [
    item.role,
    item.name,
    item.title,
    item.company,
    item.subtitle,
    item.school,
    item.summary,
    item.notes,
    ...(item.highlights ?? []).map((highlight) =>
      [highlight.title, highlight.action, highlight.metric, highlight.result].filter(Boolean).join(""),
    ),
  ]
  return normalizeForCompare(parts.filter(Boolean).join(" "))
}

function itemLabel(item: StructuredResumeItem): string {
  return cleanText(item.role || item.name || item.title || item.company || item.subtitle, 40)
}

function sectionItems(
  resume: StructuredResume,
  type: "experience" | "projects",
): Array<{ section: StructuredResumeSection; item: StructuredResumeItem }> {
  const isProject = (section: StructuredResumeSection) =>
    /project/i.test(section.type ?? "") || /项目/.test(section.title ?? "")
  const isExperience = (section: StructuredResumeSection) =>
    !isProject(section)
    && (/experience|work|job|employment/i.test(section.type ?? "")
      || /工作|任职|职业|实习/.test(section.title ?? ""))

  const match = type === "projects" ? isProject : isExperience
  return (resume.sections ?? [])
    .filter((section) => Boolean(section) && match(section))
    .flatMap((section) => (section.items ?? []).map((item) => ({ section, item })))
}

function hasInternshipEntry(resume: StructuredResume, index: SourceSectionIndex): boolean {
  const experienceItems = sectionItems(resume, "experience")
  if (experienceItems.length === 0) return false

  const labels = index.internshipLabels.map((label) => normalizeForCompare(label)).filter(Boolean)
  return experienceItems.some(({ section, item }) => {
    const haystack = `${section.title} ${item.role ?? ""} ${item.name ?? ""} ${item.company ?? ""} ${item.summary ?? ""}`
    if (INTERNSHIP_PATTERN.test(haystack)) return true
    const normalized = normalizeForCompare(haystack)
    return labels.some((label) => label.length >= 2 && normalized.includes(label.slice(0, 12)))
  })
}

/**
 * 检测三类结构性错误：
 * 1. 原文有实习，输出工作经历里却找不到独立实习条目（被并进全职岗位）；
 * 2. 项目经历条目复述了工作经历的内容（同一段事实写两个模块）；
 * 3. 工作经历条目数少于原文（经历被合并吞掉）。
 */
export function detectSectionBoundaryConflicts(
  resume: StructuredResume,
  index: SourceSectionIndex | null,
): BoundaryConflict[] {
  const conflicts: BoundaryConflict[] = []
  const experiences = sectionItems(resume, "experience")
  const projects = sectionItems(resume, "projects")

  if (index?.hasInternship && experiences.length > 0 && !hasInternshipEntry(resume, index)) {
    conflicts.push({
      code: "INTERNSHIP_MERGED",
      severity: "error",
      message:
        "原始简历含实习经历，但工作经历里没有独立的实习条目（疑似被并入全职岗位）。实习与正式岗位必须分开写。",
    })
  }

  for (const project of projects) {
    const projectText = itemText(project.item)
    if (projectText.length < MIN_COMPARE_LENGTH) continue

    for (const experience of experiences) {
      const ratio = overlapRatio(projectText, itemText(experience.item))
      if (ratio < 0.6) continue
      const projectName = itemLabel(project.item) || "项目条目"
      const experienceName = itemLabel(experience.item) || "工作经历条目"
      conflicts.push({
        code: "PROJECT_RESTATES_EXPERIENCE",
        severity: ratio >= 0.75 ? "error" : "warning",
        message: `项目经历「${projectName}」与工作经历「${experienceName}」内容重复 ${Math.round(ratio * 100)}%，同一段事实只能出现在一个模块里`,
      })
      break
    }
  }

  if (index?.origin === "snapshot") {
    const sourceExperience = index.sections
      .filter((section) => section.kind === "experience")
      .reduce((total, section) => total + section.items.length, 0)
    const sourceProject = index.sections
      .filter((section) => section.kind === "projects")
      .reduce((total, section) => total + section.items.length, 0)

    if (sourceExperience > 0 && experiences.length > 0 && experiences.length < sourceExperience) {
      conflicts.push({
        code: "ITEM_COUNT_MISMATCH",
        severity: "warning",
        message: `原文工作经历共 ${sourceExperience} 条，输出只有 ${experiences.length} 条，可能有经历被合并或遗漏`,
      })
    }
    if (sourceProject > 0 && projects.length > 0 && projects.length < sourceProject) {
      conflicts.push({
        code: "ITEM_COUNT_MISMATCH",
        severity: "warning",
        message: `原文项目经历共 ${sourceProject} 条，输出只有 ${projects.length} 条，可能有项目被合并或遗漏`,
      })
    }
  }

  return conflicts
}

export function hasBlockingBoundaryConflict(conflicts: BoundaryConflict[]): boolean {
  return conflicts.some((conflict) => conflict.severity === "error")
}

/** 供质量门禁复用：按模块类型取出结构化条目（容错单复数与中文标题） */
export function getStructuredSectionItems(
  resume: StructuredResume,
  type: "experience" | "projects",
): Array<{ section: StructuredResumeSection; item: StructuredResumeItem }> {
  return sectionItems(resume, type)
}
