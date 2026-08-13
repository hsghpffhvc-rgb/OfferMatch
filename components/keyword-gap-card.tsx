"use client"

import { Tags } from "lucide-react"
import type { KeywordAnalysis } from "@/lib/agent/types"
import { cn } from "@/lib/utils"

interface KeywordGapCardProps {
  keywordAnalysis?: KeywordAnalysis | null
  isLoading?: boolean
}

function KeywordTag({
  label,
  className,
}: {
  label: string
  className: string
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium",
        className
      )}
    >
      {label}
    </span>
  )
}

export function KeywordGapCard({
  keywordAnalysis,
  isLoading,
}: KeywordGapCardProps) {
  const data = keywordAnalysis ?? {
    jdKeywords: [],
    matched: [],
    missing: [],
    newlyCovered: [],
    stillMissing: [],
  }

  const total = data.jdKeywords.length
  const covered = data.matched.length
  const missingCount = data.missing.length
  const newlyCoveredCount = data.newlyCovered.length

  return (
    <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-accent text-primary">
            <Tags className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-medium">关键词交叉比对</p>
            <p className="text-xs text-muted-foreground">JD 关键词、命中与重写覆盖情况</p>
          </div>
        </div>
        <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-foreground">
          {isLoading && !keywordAnalysis ? "分析中…" : `已覆盖 ${covered}/${total || 0}`}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">已覆盖</p>
          <p className="mt-1 text-lg font-semibold text-foreground">{covered}/{total || 0}</p>
        </div>
        <div className="rounded-2xl bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">缺失</p>
          <p className="mt-1 text-lg font-semibold text-foreground">{missingCount}</p>
        </div>
        <div className="rounded-2xl bg-muted/30 p-3">
          <p className="text-xs text-muted-foreground">新增</p>
          <p className="mt-1 text-lg font-semibold text-foreground">{newlyCoveredCount}</p>
        </div>
      </div>

      <div className="mt-4 space-y-3 text-sm">
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">匹配到的关键词</p>
          <div className="flex flex-wrap gap-2">
            {data.matched.length ? (
              data.matched.map((item) => (
                <KeywordTag
                  key={item}
                  label={item}
                  className="bg-blue-500/10 text-blue-600 ring-1 ring-inset ring-blue-500/20"
                />
              ))
            ) : (
              <span className="text-xs text-muted-foreground">暂无</span>
            )}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">仍缺失的关键词</p>
          <div className="flex flex-wrap gap-2">
            {data.missing.length ? (
              data.missing.map((item) => (
                <KeywordTag
                  key={item}
                  label={item}
                  className="bg-red-500/10 text-red-600 ring-1 ring-inset ring-red-500/20"
                />
              ))
            ) : (
              <span className="text-xs text-muted-foreground">暂无</span>
            )}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">重写后新增覆盖</p>
          <div className="flex flex-wrap gap-2">
            {data.newlyCovered.length ? (
              data.newlyCovered.map((item) => (
                <KeywordTag
                  key={item}
                  label={item}
                  className="bg-emerald-500/10 text-emerald-600 ring-1 ring-inset ring-emerald-500/20"
                />
              ))
            ) : (
              <span className="text-xs text-muted-foreground">暂无</span>
            )}
          </div>
        </div>
      </div>

      {data.stillMissing.length > 0 && (
        <div className="mt-4 rounded-2xl border border-dashed border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
          仍需补强：{data.stillMissing.join("、")}
        </div>
      )}
    </div>
  )
}
