"use client"

import type { PersonaResult } from "@/lib/agent/types"
import { Target, CheckCircle2 } from "lucide-react"

const placeholder: PersonaResult = {
  title: "等待分析",
  industry: "上传 JD 后开始",
  hardSkills: [],
  softSkills: [],
  businessPainPoints: [],
  interviewKeywords: [],
  optimizationAdvice: [],
}

interface PersonaCardProps {
  persona?: PersonaResult | null
  isLoading?: boolean
}

export function PersonaCard({ persona, isLoading }: PersonaCardProps) {
  const data = persona ?? placeholder
  const tags = [...data.hardSkills, ...data.softSkills].slice(0, 8)
  const advices = data.optimizationAdvice.length
    ? data.optimizationAdvice
    : ["分析完成后将显示针对性优化建议"]

  return (
    <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-soft">
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-xl bg-accent text-primary">
          <Target className="size-5" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-medium">目标人设画像</p>
          <p className="text-xs text-muted-foreground">
            {isLoading && !persona ? "AI 正在解析…" : `${data.title} · ${data.industry}`}
          </p>
        </div>
      </div>

      {tags.length > 0 && (
        // 关键词标签：统一高度、左对齐换行
        <div className="mt-4 flex flex-wrap items-stretch justify-start gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex min-h-8 items-center rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs font-medium leading-none text-secondary-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* 三块信息区统一左边线、内边距与间距，保证上下沿左对齐 */}
      <div className="mt-4 space-y-3">
        {data.interviewKeywords.length > 0 && (
          <div className="rounded-2xl border border-border/60 bg-secondary/50 p-3">
            <p className="text-sm font-bold text-foreground">面试官关注关键词</p>
            <p className="mt-1.5 text-xs leading-relaxed text-foreground">
              {data.interviewKeywords.join(" · ")}
            </p>
          </div>
        )}

        {data.businessPainPoints.length > 0 && (
          <div className="rounded-2xl border border-border/60 bg-muted/30 p-3">
            <p className="text-sm font-bold text-foreground">业务痛点</p>
            <p className="mt-1.5 text-xs leading-relaxed text-foreground">
              {data.businessPainPoints.join(" · ")}
            </p>
          </div>
        )}

        <div className="space-y-2 rounded-2xl border border-border/60 bg-accent/40 p-3">
          <p className="text-sm font-bold text-foreground">优化建议</p>
          {advices.map((advice) => (
            <div key={advice} className="flex items-start gap-2 text-xs text-foreground">
              <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden="true" />
              <span className="leading-relaxed">{advice}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
