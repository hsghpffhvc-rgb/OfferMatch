"use client"

import { useMemo, useState } from "react"
import { Check, ChevronDown, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ResumePdfPreview } from "@/components/resume-pdf-preview"
import { mapRewriteResultToResumeData } from "@/lib/pdf/mapper"
import type { RewriteResult } from "@/lib/agent/types"
import { cn } from "@/lib/utils"

interface ResumePreviewProps {
  markdown: string
  isLoading?: boolean
  rewriteResult?: RewriteResult | null
  resumePhoto?: string | null
}

export function ResumePreview({
  markdown,
  isLoading,
  rewriteResult,
  resumePhoto,
}: ResumePreviewProps) {
  const parts = useResumePreviewParts({
    markdown,
    isLoading,
    rewriteResult,
    resumePhoto,
  })

  if (!parts.markdown && !parts.pdf) return null

  return (
    <div className="mt-6 flex w-full flex-col gap-6 text-left">
      {parts.markdown}
      {parts.pdf}
    </div>
  )
}

export function useResumePreviewParts({
  markdown,
  isLoading,
  rewriteResult,
  resumePhoto,
}: ResumePreviewProps) {
  const [copied, setCopied] = useState(false)
  const [pdfOpen, setPdfOpen] = useState(false)

  const pdfMapping = useMemo(() => {
    if (!rewriteResult) return { data: null, error: null as string | null }
    try {
      return {
        data: mapRewriteResultToResumeData(rewriteResult, {
          basics: resumePhoto ? { photo: resumePhoto } : undefined,
        }),
        error: null,
      }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : "简历结构化数据无效，暂时无法导出 PDF",
      }
    }
  }, [rewriteResult, resumePhoto])

  const mappedData = pdfMapping.data
  const showMarkdown = Boolean(markdown) || Boolean(isLoading)

  const handleCopy = async () => {
    if (!markdown) return
    await navigator.clipboard.writeText(markdown)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const markdownCard = showMarkdown ? (
    <div className="w-full text-left">
      <div className="rounded-3xl border border-border/70 bg-card p-4 shadow-soft">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-sm font-medium">重写简历预览</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void handleCopy()}
            disabled={!markdown}
            className="gap-1.5 rounded-full"
          >
            {copied ? (
              <>
                <Check className="size-3.5" aria-hidden="true" />
                已复制
              </>
            ) : (
              <>
                <Copy className="size-3.5" aria-hidden="true" />
                一键 Copy
              </>
            )}
          </Button>
        </div>
        <div className="max-h-96 overflow-y-auto rounded-2xl border border-border/50 bg-background p-4">
          {isLoading && !markdown ? (
            <p className="text-sm text-muted-foreground">
              阶段 C 完成后将显示重写简历…
            </p>
          ) : (
            <article className="prose prose-sm max-w-none dark:prose-invert">
              <MarkdownContent content={markdown} />
            </article>
          )}
        </div>
      </div>
    </div>
  ) : null

  const pdfCard = mappedData ? (
    <div className="w-full overflow-hidden rounded-3xl border border-border/70 bg-card text-left shadow-soft">
      <button
        type="button"
        onClick={() => setPdfOpen((open) => !open)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40"
        aria-expanded={pdfOpen}
      >
        <span className="text-sm font-medium">📄 简历预览 & 导出</span>
        <span className="text-xs text-muted-foreground">
          {pdfOpen ? "收起" : "点击生成预览"}
        </span>
        <ChevronDown
          className={cn(
            "size-4 text-muted-foreground transition-transform",
            pdfOpen && "rotate-180"
          )}
          aria-hidden="true"
        />
      </button>
      {pdfOpen ? (
        <div className="border-t border-border/50 px-2 pb-2 sm:px-3 sm:pb-3">
          <ResumePdfPreview
            resumeData={mappedData}
            defaultTemplate="minimal"
          />
        </div>
      ) : null}
    </div>
  ) : pdfMapping.error ? (
    <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
      {pdfMapping.error}
    </p>
  ) : null

  return { markdown: markdownCard, pdf: pdfCard }
}

function MarkdownContent({ content }: { content: string }) {
  const lines = content.split("\n")
  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {lines.map((line, i) => {
        if (line.startsWith("### ")) {
          return (
            <h3 key={i} className="mt-4 text-base font-semibold">
              {line.slice(4)}
            </h3>
          )
        }
        if (line.startsWith("## ")) {
          return (
            <h2 key={i} className="mt-4 text-lg font-semibold">
              {line.slice(3)}
            </h2>
          )
        }
        if (line.startsWith("# ")) {
          return (
            <h1 key={i} className="text-xl font-bold">
              {line.slice(2)}
            </h1>
          )
        }
        if (line.startsWith("- ") || line.startsWith("* ")) {
          return (
            <p key={i} className="pl-4 text-muted-foreground">
              • {line.slice(2)}
            </p>
          )
        }
        if (line.trim() === "") return <br key={i} />
        return (
          <p key={i} className="text-foreground">
            {line}
          </p>
        )
      })}
    </div>
  )
}
