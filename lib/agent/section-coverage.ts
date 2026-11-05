import type { RewriteResult, StructuredResumeSection } from "@/lib/agent/types"

export type RequiredSectionType = "experience" | "projects" | "education"

export interface RequiredSection {
  type: RequiredSectionType
  label: string
  sourceBlock: string
}

const SECTION_HEADINGS: Record<RequiredSectionType, RegExp> = {
  experience: /^(工作经历|工作经验|职业经历|任职经历)\s*[：:]?$/,
  projects: /^(项目经历|项目经验|核心项目|代表项目|主要项目|项目实践)\s*[：:]?$/,
  education: /^(教育背景|教育经历|教育信息|学历背景)\s*[：:]?$/,
}

const SECTION_LABELS: Record<RequiredSectionType, string> = {
  experience: "工作经历",
  projects: "项目经历",
  education: "教育背景",
}

const SECTION_ORDER = [
  "工作经历",
  "工作经验",
  "实习经历",
  "实习经验",
  "职业经历",
  "任职经历",
  "项目经历",
  "项目经验",
  "核心项目",
  "代表项目",
  "主要项目",
  "项目实践",
  "教育背景",
  "教育经历",
  "教育信息",
  "学历背景",
  "专业技能",
  "技能",
  "荣誉奖项",
  "获奖情况",
  "证书",
  "语言能力",
  "个人简介",
  "个人总结",
  "自我评价",
  "联系方式",
]

function normalizedHeading(line: string): string {
  return line.trim().replace(/^#{1,6}\s*/, "").replace(/\s+/g, "")
}

/** Extract an original resume module without sending it back as body copy. */
export function extractOriginalSectionBlock(
  originalResume: string,
  type: RequiredSection["type"],
): string {
  const lines = originalResume.replace(/\r\n/g, "\n").split("\n")
  const pattern = SECTION_HEADINGS[type]
  const start = lines.findIndex((line) => pattern.test(normalizedHeading(line)) ||
    (type === "education" && /^(教育背景|教育经历|教育信息|学历背景)[：:]\S+/.test(normalizedHeading(line))))
  if (start < 0) return ""

  const nextSection = lines.findIndex(
    (line, index) => index > start && SECTION_ORDER.some((heading) => new RegExp(`^${heading}[：:]?$`).test(normalizedHeading(line))),
  )
  return lines.slice(start, nextSection < 0 ? undefined : nextSection).join("\n").trim()
}

/**
 * Detects project/education sections present in the source but omitted from output.
 * The repair prompt receives the source section as evidence; the audit never pastes
 * this text into the deliverable resume.
 */
export function getMissingSourceSections(
  rewrite: RewriteResult,
  originalResume: string,
): RequiredSection[] {
  const missing: RequiredSection[] = []
  for (const type of ["experience", "projects", "education"] as const) {
    const sourceBlock = extractOriginalSectionBlock(originalResume, type)
    if (!sourceBlock) continue

    const present = rewrite.resume.sections.some((section) => section.type === type && Array.isArray(section.items) && section.items.some((item) =>
      Boolean(item && [item.school, item.name, item.title, item.role, item.company, item.degree, item.major, item.summary, item.notes].some((value) => typeof value === "string" && value.trim()) || item?.highlights?.length),
    ))
    if (!present) {
      missing.push({ type, label: SECTION_LABELS[type], sourceBlock })
    }
  }
  return missing
}

/** Education facts do not need rewriting. Preserve a clearly delimited source block
 * verbatim if the model omits it, without guessing schools, dates or degrees. */
export function restoreSourceEducation(rewrite: RewriteResult, originalResume: string): RewriteResult {
  if (!getMissingSourceSections(rewrite, originalResume).some((section) => section.type === "education")) return rewrite
  const block = extractOriginalSectionBlock(originalResume, "education")
  const [heading = "", ...body] = block.split("\n")
  const inline = heading.trim().replace(/^#{1,6}\s*/, "").match(/^(?:教育背景|教育经历|教育信息|学历背景)\s*[：:]\s*(.+)$/)?.[1]
  const lines = [inline ?? "", ...body].map((line) => line.trim()).filter(Boolean)
  const items = lines.flatMap((line) => line.match(/[\s\S]{1,200}/gu) ?? []).map((notes) => ({ notes }))
  if (!items.length) return rewrite
  return {
    ...rewrite,
    resume: {
      ...rewrite.resume,
      sections: [
        ...rewrite.resume.sections.filter((section) => section.type !== "education"),
        { type: "education", title: "教育背景", items },
      ],
    },
  }
}

/** Replaces only project/education sections with the repaired model output. */
export function mergeRepairedSections(
  current: RewriteResult,
  repaired: RewriteResult,
  missingTypes: Array<RequiredSection["type"]>,
): RewriteResult {
  const replacement = repaired.resume.sections.filter((section) => missingTypes.includes(section.type as RequiredSection["type"]))
  const kept = current.resume.sections.filter((section) => !missingTypes.includes(section.type as RequiredSection["type"]))
  const mergedSections: StructuredResumeSection[] = [...kept, ...replacement]

  return {
    ...current,
    resume: {
      ...current.resume,
      sections: mergedSections,
      skills: current.resume.skills,
    },
    analysis: current.analysis ?? repaired.analysis,
    modifications: [...current.modifications, ...repaired.modifications],
    rewrittenResumeMarkdown: "", // re-render from merged structured data in the quality gate
  }
}
