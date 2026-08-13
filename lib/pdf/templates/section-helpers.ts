import type { ResumeData, ResumeHighlight, ResumeSection, ResumeSectionItem, SectionType } from "@/lib/pdf/types"

const EMPTY_TEXT_RE = /^\s*$/

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

/** 按 type 取 items，没有则返回空数组 */
export function getItems(resume: ResumeData, type: SectionType): ResumeSectionItem[] {
  return filterRenderableItems(getSection(resume, type)?.items ?? [])
}

/** 取 summary 文本 */
export function getSummary(resume: ResumeData): string {
  const item = getItems(resume, "summary")[0]
  return cleanText(item?.description) || cleanText(item?.title)
}

/** 取 awards 列表（string[]） */
export function getAwards(resume: ResumeData): string[] {
  return getItems(resume, "awards")
    .map((i) => cleanText(i.title) || cleanText(i.description))
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
