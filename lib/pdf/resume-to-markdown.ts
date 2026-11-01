import type { RewriteResult } from "@/lib/agent/types"
import { mapRewriteResultToResumeData } from "@/lib/pdf/mapper"

const CONTACT_SEPARATOR = " | "

/**
 * 当模型没有返回 rewrittenResumeMarkdown 时，用结构化简历数据自渲染 Markdown。
 * 模型偶尔会省略该字段，此时不能直接展示兜底文案，否则用户会误以为重写服务不可用。
 */
export function buildMarkdownFromRewrite(rewrite: RewriteResult): string {
  let data
  try {
    data = mapRewriteResultToResumeData(rewrite)
  } catch {
    return [rewrite.resume?.summary?.text, rewrite.rewrittenResumeMarkdown]
      .filter((item): item is string => Boolean(item && String(item).trim()))
      .join("\n\n")
      .trim()
  }

  const lines: string[] = []
  const { basics } = data

  if (basics.name) lines.push(`# ${basics.name}`)
  if (basics.title) lines.push(`**${basics.title}**`)

  const contacts = [basics.phone, basics.email, basics.location, basics.website, basics.github, basics.linkedin]
    .filter((item): item is string => Boolean(item && String(item).trim()))
  if (contacts.length > 0) lines.push(contacts.join(CONTACT_SEPARATOR))

  for (const section of data.sections) {
    const items = section.items ?? []
    if (items.length === 0) continue

    lines.push("", `## ${section.title}`)

    for (const item of items) {
      const heading = [item.title, item.subtitle].filter(Boolean).join(" · ")
      const meta = [item.date, item.location].filter(Boolean).join(CONTACT_SEPARATOR)

      if (heading) lines.push("", `**${heading}**`)
      if (meta) lines.push(meta)
      if (item.description) lines.push(item.description)

      for (const highlight of item.highlights ?? []) {
        const text = typeof highlight === "string" ? highlight : highlight.text
        if (text && text.trim()) lines.push(`- ${text.trim()}`)
      }
    }
  }

  const markdown = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()
  if (markdown) return markdown

  return rewrite.rewrittenResumeMarkdown?.trim() ?? ""
}
