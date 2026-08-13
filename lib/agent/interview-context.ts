import type { PersonaResult, RewriteResult } from "@/lib/agent/types"

export interface InterviewEvidence {
  label: string
  summary: string
  highlights: string[]
}

export interface InterviewContext {
  targetTitle: string
  hardSkills: string[]
  softSkills: string[]
  keywords: string[]
  experiences: InterviewEvidence[]
  skills: string[]
}

const MAX_TEXT_LENGTH = 220

function compactText(value: string | undefined, max = MAX_TEXT_LENGTH): string {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, max)
}

/** Keeps only evidence an interviewer can meaningfully question. */
export function buildInterviewContext(
  persona: PersonaResult,
  rewrite: RewriteResult,
): InterviewContext {
  const experiences = rewrite.resume.sections
    .filter((section) =>
      /项目|工作|实习|经历|project|experience|intern/i.test(
        `${section.type} ${section.title}`,
      ),
    )
    .flatMap((section) => section.items)
    .map((item) => {
      const itemLabel = item.name ?? item.title ?? item.role ?? item.company
      const label = compactText(itemLabel, 80) || "相关经历"
      const summary = compactText(item.summary)
      const highlights = (item.highlights ?? [])
        .map((highlight) =>
          compactText(
            [highlight.title, highlight.action, highlight.metric, highlight.result]
              .filter(Boolean)
              .join("；"),
          ),
        )
        .filter(Boolean)
        .slice(0, 3)
      return { label, summary, highlights }
    })
    .filter((item) => item.summary || item.highlights.length > 0)
    .slice(0, 4)

  const skills = rewrite.resume.skills
    .flatMap((group) => group.items)
    .map((skill) => compactText(skill.name, 40))
    .filter(Boolean)
    .slice(0, 10)

  return {
    targetTitle: compactText(persona.title, 80),
    hardSkills: persona.hardSkills.slice(0, 8).map((item) => compactText(item, 40)),
    softSkills: persona.softSkills.slice(0, 5).map((item) => compactText(item, 40)),
    keywords: persona.interviewKeywords.slice(0, 8).map((item) => compactText(item, 40)),
    experiences,
    skills,
  }
}
