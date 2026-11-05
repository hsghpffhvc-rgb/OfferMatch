import type { ResumeSnapshot, StructuredResume } from "@/lib/agent/types"

/** Recover only fields that can be checked against the same source resume. */
export function recoverResumeBasics(
  current: StructuredResume["basics"],
  original: string,
  snapshot?: ResumeSnapshot,
  previous?: Partial<StructuredResume["basics"]>,
): StructuredResume["basics"] {
  const source = original.replace(/\s+/g, "").toLowerCase()
  const withoutEmails = original.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, " ")
  const sourced = (value: string | undefined) => {
    const normalized = (value ?? "").replace(/\s+/g, "").toLowerCase()
    return normalized.length >= 2 && source.includes(normalized)
  }
  const contact = (pattern: RegExp, text = original): string => {
    const matches = [...text.matchAll(pattern)].map((match) => match[0].trim())
    const unique = [...new Set(matches.map((item) => item.toLowerCase()))]
    return unique.length === 1 ? matches[0] : ""
  }
  const fallbackName = [previous?.name, snapshot?.basics?.name]
    .find((name) => name && !/^(求职者|姓名|name|候选人)$/i.test(name.trim()) && sourced(name)) ?? ""
  const result = { ...current }
  const labeledName = original.match(/(?:^|\n)[ \t]*(?:姓名|name)[ \t]*[：:][ \t]*([\p{Script=Han}A-Za-z·]{2,40})(?=[ \t\r\n]|$)/iu)?.[1] ?? ""
  if (!result.name?.trim()) result.name = fallbackName || labeledName
  if (!result.title?.trim() && previous?.title?.trim()) result.title = previous.title
  if (!result.title?.trim() && sourced(snapshot?.basics?.title)) result.title = snapshot?.basics?.title ?? ""
  for (const field of ["phone", "email", "location", "linkedin", "github", "website"] as const) {
    const supported = field === "phone"
      ? Boolean(previous?.phone && withoutEmails.replace(/\s+/g, "").includes(previous.phone.replace(/\s+/g, "")))
      : sourced(previous?.[field])
    if (!result[field]?.trim() && supported) result[field] = previous?.[field] ?? ""
  }
  if (!result.email?.trim()) result.email = contact(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi)
  if (!result.phone?.trim()) {
    result.phone = contact(/(?<!\d)(?:\+?86[ -]?)?1[3-9]\d{9}(?!\d)/g, withoutEmails)
  }
  return result
}

/** A retry can fill gaps, but must not discard complete sections from the same analysis. */
export function retainMissingResumeContent(
  current: StructuredResume,
  previous?: StructuredResume,
): StructuredResume {
  if (!previous || !Array.isArray(previous.sections)) return current
  const sections = [...current.sections]
  for (const type of ["experience", "projects", "education"] as const) {
    if (sections.some((section) => section.type === type && section.items?.length)) continue
    const previousSections = previous.sections.filter((section) =>
      section.type === type && Array.isArray(section.items) && section.items.length > 0,
    )
    sections.push(...previousSections)
  }
  return {
    ...current,
    sections,
    skills: current.skills.length ? current.skills : previous.skills ?? [],
    summary: current.summary?.text?.trim() ? current.summary : previous.summary ?? current.summary,
  }
}
