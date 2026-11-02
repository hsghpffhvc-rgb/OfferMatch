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
  education: /^(教育背景|教育经历)\s*[：:]?$/,
}

const SECTION_LABELS: Record<RequiredSectionType, string> = {
  experience: "工作经历",
  projects: "项目经历",
  education: "教育背景",
}

const SECTION_ORDER = [
  "工作经历",
  "工作经验",
  "项目经历",
  "项目经验",
  "核心项目",
  "代表项目",
  "主要项目",
  "项目实践",
  "教育背景",
  "教育经历",
  "专业技能",
  "技能",
  "荣誉奖项",
  "获奖情况",
  "证书",
  "语言能力",
]

/** Extract an original resume module without sending it back as body copy. */
export function extractOriginalSectionBlock(
  originalResume: string,
  type: RequiredSection["type"],
): string {
  const lines = originalResume.replace(/\r\n/g, "\n").split("\n")
  const pattern = SECTION_HEADINGS[type]
  const start = lines.findIndex((line) => pattern.test(line.trim()))
  if (start < 0) return ""

  const nextSection = lines.findIndex(
    (line, index) => index > start && SECTION_ORDER.some((heading) => new RegExp(`^${heading}\\s*[：:]?$`).test(line.trim())),
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

    const present = rewrite.resume.sections.some((section) => section.type === type)
    if (!present) {
      missing.push({ type, label: SECTION_LABELS[type], sourceBlock })
    }
  }
  return missing
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
      skills: repaired.resume.skills.length ? repaired.resume.skills : current.resume.skills,
    },
    analysis: current.analysis ?? repaired.analysis,
    modifications: [...current.modifications, ...repaired.modifications],
    rewrittenResumeMarkdown: "", // re-render from merged structured data in the quality gate
  }
}
