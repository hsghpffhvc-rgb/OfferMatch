import type { ResumeData, ResumeHighlight, ResumeSection, ResumeSectionItem, SectionType } from "@/lib/pdf/types"

const EMPTY_TEXT_RE = /^\s*$/

/** Custom section titles must have a visible fallback instead of an unexplained dot. */
export function getSectionIconLabel(title: string): string {
  return Array.from(title.trim()).find((char) => /[\p{L}\p{N}]/u.test(char)) ?? "简"
}

function cleanText(value?: string): string {
  return value
    ?.replace(/\*{1,3}|_{1,3}|`/g, "")
    .replace(/[\t ]+/g, " ")
    .trim() ?? ""
}

function isNonEmptyText(value?: string): value is string {
  return Boolean(value && !EMPTY_TEXT_RE.test(value))
}

export function filterRenderableItems(items: ResumeSectionItem[]): ResumeSectionItem[] {
  return items.map((item) => ({
    ...item,
    projectName: cleanText(item.projectName) || undefined,
    title: cleanText(item.title) || undefined,
    subtitle: cleanText(item.subtitle) || undefined,
    date: cleanText(item.date) || undefined,
    location: cleanText(item.location) || undefined,
    description: cleanText(item.description) || undefined,
    highlights: getHighlights(item),
    url: cleanText(item.url) || undefined,
    degree: cleanText(item.degree) || undefined,
    gpa: cleanText(item.gpa) || undefined,
  }))
}

export function getHighlights(item: ResumeSectionItem): ResumeHighlight[] {
  return (item.highlights ?? [])
    .map((point) =>
      typeof point === "string"
        ? { text: cleanText(point) }
        : { title: cleanText(point.title) || undefined, text: cleanText(point.text) }
    )
    .filter((point) => isNonEmptyText(point.text))
}

/** 按 type 取第一个匹配的 section */
export function getSection(resume: ResumeData, type: SectionType): ResumeSection | undefined {
  return resume.sections.find((s) => s.type === type)
}

/**
 * 按 type 取所有匹配的 section（保持原顺序）。
 * 「工作经历」与「实习经历」都是 experience 类型，需要各自成块渲染。
 */
export function getSectionGroups(
  resume: ResumeData,
  type: SectionType
): { title: string; items: ResumeSectionItem[] }[] {
  return resume.sections
    .filter((section) => section.type === type)
    .map((section) => ({
      title: cleanText(section.title) || DEFAULT_GROUP_TITLE[type],
      items: filterRenderableItems(section.items ?? []),
    }))
    .filter((group) => group.items.length > 0)
}

const DEFAULT_GROUP_TITLE: Record<SectionType, string> = {
  summary: "个人总结",
  experience: "工作经历",
  education: "教育背景",
  skills: "专业技能",
  projects: "项目经历",
  languages: "语言能力",
  certifications: "证书",
  awards: "荣誉奖项",
  other: "其他",
}

/** 按 type 取 items，没有则返回空数组 */
export function getItems(resume: ResumeData, type: SectionType): ResumeSectionItem[] {
  return filterRenderableItems(getSection(resume, type)?.items ?? [])
}

export interface ExperienceRole {
  projectName?: string
  title?: string
  date?: string
  highlights: ResumeHighlight[]
  description?: string
}

export interface ExperienceGroup {
  /** 单位名（同一单位的多个岗位只展示一次） */
  company?: string
  location?: string
  date?: string
  roles: ExperienceRole[]
}

function uniqueDates(dates: string[]): string {
  const values = dates.map((date) => cleanText(date)).filter((date) => date.length > 0)
  const unique = [...new Set(values)]
  if (unique.length <= 1) return unique[0] ?? ""
  return unique.join("  /  ")
}

/**
 * 同一单位的多个岗位合并成一个单位块：
 * 单位只出现一次，岗位与各自要点在块内依次列出。
 */
export function groupExperienceItems(items: ResumeSectionItem[]): ExperienceGroup[] {
  const groups: ExperienceGroup[] = []

  for (const item of items) {
    const company = cleanText(item.subtitle) || undefined
    if (!company) {
      groups.push({
        company: undefined,
        location: cleanText(item.location) || undefined,
        date: cleanText(item.date) || undefined,
        roles: [
          {
            projectName: cleanText(item.projectName) || undefined,
            title: cleanText(item.title) || undefined,
            date: cleanText(item.date) || undefined,
            highlights: getHighlights(item),
            description: cleanText(item.description) || undefined,
          },
        ],
      })
      continue
    }

    const existing = groups.find((group) => group.company === company)
    const role: ExperienceRole = {
      projectName: cleanText(item.projectName) || undefined,
      title: cleanText(item.title) || undefined,
      date: cleanText(item.date) || undefined,
      highlights: getHighlights(item),
      description: cleanText(item.description) || undefined,
    }

    if (existing) {
      existing.roles.push(role)
      existing.date = uniqueDates([
        ...existing.roles.map((entry) => entry.date ?? ""),
      ])
      if (!existing.location && item.location) existing.location = cleanText(item.location)
      continue
    }

    groups.push({
      company,
      location: cleanText(item.location) || undefined,
      date: cleanText(item.date) || undefined,
      roles: [role],
    })
  }

  return groups
}

/** 取 summary 文本 */
export function getSummary(resume: ResumeData): string {
  const item = getItems(resume, "summary")[0]
  return cleanText(item?.description) || cleanText(item?.title)
}

/** 取 awards 列表（string[]）：项目/活动名为标题，具体奖项清单跟在冒号后 */
export function getAwards(resume: ResumeData): string[] {
  return resume.sections
    .filter((section) => section.type === "awards")
    .flatMap((section) => filterRenderableItems(section.items ?? []))
    .map((item) => {
      const title = cleanText(item.title)
      const detail = cleanText(item.description)
      if (title && detail && title !== detail) return `${title}：${detail}`
      return title || detail
    })
    .filter(isNonEmptyText)
}

/** 取 skills 分组：subtitle/description 为分组名；无分组信息时 group 为空（避免与章节标题重复） */
export function getSkillGroups(resume: ResumeData): { group: string; items: string[] }[] {
  const section = getSection(resume, "skills")
  if (!section) return []

  const normalizedItems = filterRenderableItems(section.items)
  const hasExplicitGroup = normalizedItems.some(
    (item) => Boolean(cleanText(item.subtitle) || cleanText(item.description))
  )

  // 无任何分组字段时，合并为一组，不渲染子标题
  if (!hasExplicitGroup) {
    const items = normalizedItems.map((i) => cleanText(i.title)).filter(isNonEmptyText)
    return items.length > 0 ? [{ group: "", items }] : []
  }

  const grouped: Record<string, string[]> = {}
  for (const item of normalizedItems) {
    const group = cleanText(item.subtitle) || cleanText(item.description) || "其他"
    const name = cleanText(item.title)
    if (name) {
      if (!grouped[group]) grouped[group] = []
      grouped[group].push(name)
    }
  }

  return Object.entries(grouped).map(([group, items]) => ({ group, items: items.filter(isNonEmptyText) }))
}

/** 取 languages 列表 */
export function getLanguages(resume: ResumeData): { name: string; level?: string }[] {
  return getItems(resume, "languages")
    .map((i) => ({ name: cleanText(i.title), level: cleanText(i.subtitle) || cleanText(i.description) || undefined }))
    .filter((l) => l.name)
}

/** 拼接联系信息，过滤空值，用分隔符连接 */
export function buildContactLine(resume: ResumeData, separator = "  ·  "): string {
  const { phone, email, location, website, linkedin, github } = resume.basics
  return [phone, email, location, website, linkedin, github]
    .map((v) => cleanText(v))
    .filter(isNonEmptyText)
    .join(separator)
}
