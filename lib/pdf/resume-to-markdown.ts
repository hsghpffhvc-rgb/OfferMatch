import type { RewriteResult } from "@/lib/agent/types"
import { renderResumeMarkdown } from "@/lib/agent/rewrite-quality"

/**
 * 兼容入口：正文始终由结构化简历渲染（唯一来源）。
 * 历史记录等场景可能只有结构化数据，这里不再拼装模型返回的原始 Markdown。
 */
export function buildMarkdownFromRewrite(rewrite: RewriteResult): string {
  if (!rewrite?.resume) return ""
  return renderResumeMarkdown(rewrite.resume)
}
