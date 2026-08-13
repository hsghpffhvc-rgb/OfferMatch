import type {
  RewriteResult,
  StructuredResumeHighlight,
  StructuredResumeItem,
} from "@/lib/agent/types"
import type {
  ResumeBasics,
  ResumeData,
  ResumeHighlight,
  ResumeSection,
  ResumeSectionItem,
  SectionType,
} from "@/lib/pdf/types"

export interface MapRewriteOptions {
  basics?: Partial<ResumeBasics>
}

const VALID_SECTION_TYPES = new Set<SectionType>([
  "summary",
  "experience",
  "education",
  "skills",
  "projects",
  "languages",
  "certifications",
  "awards",
])

function cleanText(value: unknown, maxLength = 1000): string {
  if (typeof value !== "string") return ""
  return value
    .replace(/\*{1,3}|_{1,3}|`/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[\t ]+/g, " ")
    .trim()
    .slice(0, maxLength)
}

function formatDate(value: StructuredResumeItem["date"]): string {
  const start = cleanText(value?.start, 30)
  const end = cleanText(value?.end, 30)
  return [start, end].filter(Boolean).join(" - ")
}

function deriveHighlightTitle(action: unknown): string {
  return cleanText(action, 10)
}

function formatHighlight(highlight: StructuredResumeHighlight): ResumeHighlight {
  return {
    title: cleanText(highlight.title, 10) || deriveHighlightTitle(highlight.action),
    text: [highlight.action, highlight.metric, highlight.result]
    .map((value) => cleanText(value, 240))
    .filter(Boolean)
    .join("，"),
  }
}

function mapStructuredItem(type: SectionType, item: StructuredResumeItem): ResumeSectionItem {
  const highlights = Array.isArray(item.highlights)
    ? item.highlights.map(formatHighlight).filter((highlight) => Boolean(highlight.text))
    : []

  if (type === "experience") {
    return {
      title: cleanText(item.role, 80),
      subtitle: cleanText(item.company, 100),
      location: cleanText(item.location, 80),
      date: formatDate(item.date),
      description: cleanText(item.summary),
      highlights,
    }
  }

  if (type === "education") {
    return {
      title: cleanText(item.school || item.title, 120),
      degree: [cleanText(item.degree, 80), cleanText(item.major, 80)].filter(Boolean).join(" · "),
      date: formatDate(item.date),
      gpa: cleanText(item.gpa, 40),
      description: cleanText(item.notes || item.summary, 240),
    }
  }

  if (type === "languages") {
    return { title: cleanText(item.name || item.title, 80), subtitle: cleanText(item.level, 80) }
  }

  return {
    title: cleanText(item.name || item.title || item.role, 120),
    subtitle: cleanText(item.subtitle || item.company, 120),
    location: cleanText(item.location, 80),
    date: formatDate(item.date),
    description: cleanText(item.summary || item.notes),
    highlights,
  }
}

const SECTION_TITLES: Record<SectionType, string> = {
  summary: "个人总结",
  experience: "工作经历",
  education: "教育背景",
  skills: "专业技能",
  projects: "项目经历",
  languages: "语言能力",
  certifications: "证书",
  awards: "荣誉奖项",
}

function defaultBasics(partial?: Partial<ResumeBasics>): ResumeBasics {
  return {
    name: partial?.name?.trim() || "",
    title: partial?.title?.trim() || "",
    email: partial?.email?.trim() || "",
    phone: partial?.phone?.trim() || "",
    location: partial?.location,
    linkedin: partial?.linkedin,
    github: partial?.github,
    website: partial?.website,
    // base64 data URL 或远程 URL；不传则模板自动隐藏证件照
    photo: partial?.photo?.trim() || undefined,
  }
}

/**
 * 将 Agent C 的 RewriteResult 转为 PDF 模板用的 ResumeData。
 * Agent 语义输出 → 模板结构化输入的唯一桥梁。
 */
export function mapRewriteResultToResumeData(
  result: RewriteResult,
  options?: MapRewriteOptions
): ResumeData {
  const structured = result.resume
  if (!structured || !Array.isArray(structured.sections) || !Array.isArray(structured.skills)) {
    throw new Error("AI 未返回可导出的结构化简历数据，请重新生成后再导出 PDF")
  }

  const basics = defaultBasics({
    name: cleanText(structured.basics?.name, 80),
    title: cleanText(structured.basics?.title, 120),
    email: cleanText(structured.basics?.email, 160),
    phone: cleanText(structured.basics?.phone, 50),
    location: cleanText(structured.basics?.location, 80),
    linkedin: cleanText(structured.basics?.linkedin, 240),
    github: cleanText(structured.basics?.github, 240),
    website: cleanText(structured.basics?.website, 240),
    photo: cleanText(structured.basics?.photo, 2_000_000),
    ...options?.basics,
  })

  const sections: ResumeSection[] = []
  const summary = cleanText(structured.summary?.text || structured.summary?.positioning)
  if (summary) {
    sections.push({
      id: "summary",
      type: "summary",
      title: "个人总结",
      placement: "main",
      items: [{ description: summary }],
    })
  }

  for (const section of structured.sections) {
    if (!VALID_SECTION_TYPES.has(section.type as SectionType) || section.type === "summary" || section.type === "skills") {
      continue
    }

    const type = section.type as SectionType
    const items = [...(Array.isArray(section.items) ? section.items : [])]
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((item) => mapStructuredItem(type, item))
      .filter((item) => Boolean(item.title || item.description || item.highlights?.length))

    if (!items.length || sections.some((existing) => existing.type === type)) continue
    sections.push({
      id: type,
      type,
      title: cleanText(section.title, 40) || SECTION_TITLES[type],
      placement: type === "languages" || type === "certifications" ? "sidebar" : "main",
      items,
    })
  }

  const skills = structured.skills.flatMap((group) =>
    (Array.isArray(group.items) ? group.items : []).map((skill) => ({
      title: cleanText(skill.name, 80),
      subtitle: cleanText(group.group || skill.category, 80),
    })),
  ).filter((skill) => Boolean(skill.title))
  if (skills.length > 0) {
    sections.push({
      id: "skills",
      type: "skills",
      title: "专业技能",
      placement: "sidebar",
      items: skills,
    })
  }

  return {
    basics,
    sections,
    metadata: {
      template: "minimal",
      generatedAt: new Date().toISOString(),
    },
  }
}

/** SDD 别名 */
export const rewriteResultToResumeData = mapRewriteResultToResumeData
