"use client"

import { CheckCircle2 } from "lucide-react"
import { DIMENSIONS, type EvidenceGap } from "@/lib/agent/types"

const SEVERITY_META: Record<string, { label: string; className: string }> = {
  critical: { label: "关键缺口", className: "bg-red-500/10 text-red-600 ring-red-500/20" },
  important: { label: "重要缺口", className: "bg-amber-500/10 text-amber-600 ring-amber-500/20" },
  optional: { label: "可选补强", className: "bg-slate-500/10 text-slate-600 ring-slate-500/20" },
}

const QUESTION_TYPE_LABEL: Record<string, string> = {
  experience: "经历确认",
  metric: "数字补全",
  scope: "范围确认",
  method: "做法追问",
  outcome: "结果追问",
}

function dimensionName(key: string): string {
  return DIMENSIONS.find((item) => item.key === key)?.name ?? "匹配度"
}

interface EvidenceDetailProps {
  gaps: EvidenceGap[]
  answers: Record<string, string>
  skippedGapIds?: string[]
}

/**
 * 证据补足的只读详情。
 * 主界面用弹窗展示、/evidence 深链用整页展示，两者共用同一份渲染，避免样式与口径分叉。
 */
export function EvidenceDetail({ gaps, answers, skippedGapIds = [] }: EvidenceDetailProps) {
  const answeredCount = gaps.filter((gap) => (answers[gap.id] ?? "").trim().length > 0).length

  if (gaps.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 bg-card/60 p-6 text-center">
        <p className="text-sm text-muted-foreground">暂无证据补足记录，请先回到主界面完成阶段C。</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
        <CheckCircle2 className="size-4 text-emerald-600" aria-hidden="true" />
        共 {gaps.length} 个缺口，已回答 {answeredCount} 条，标记无相关经历 {skippedGapIds.length} 条
      </div>

      {gaps.map((gap, index) => {
        const severity = SEVERITY_META[gap.severity] ?? SEVERITY_META.important
        const answer = (answers[gap.id] ?? "").trim()
        const isSkipped = skippedGapIds.includes(gap.id) || !answer
        return (
          <article key={gap.id} className="rounded-2xl border border-border/60 bg-card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${severity.className}`}
              >
                {severity.label}
              </span>
              <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] text-muted-foreground">
                {dimensionName(gap.dimension)}
              </span>
              {gap.keyword && (
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium text-primary">
                  {gap.keyword}
                </span>
              )}
              <span className="text-[11px] text-muted-foreground">
                {QUESTION_TYPE_LABEL[gap.questionType] ?? "证据追问"}
              </span>
              <span className="ml-auto text-[11px] text-muted-foreground">第 {index + 1} 题</span>
            </div>

            {gap.whyMissing && (
              <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">{gap.whyMissing}</p>
            )}

            {gap.resumeAnchor && (
              <p className="mt-2 border-l-2 border-border pl-2.5 text-xs italic text-muted-foreground">
                简历原文：{gap.resumeAnchor}
              </p>
            )}

            <p className="mt-3 text-sm font-medium leading-relaxed text-foreground">{gap.question}</p>

            <div
              className={`mt-2.5 rounded-xl px-3 py-2.5 text-sm leading-relaxed ${
                isSkipped ? "bg-muted/40 text-muted-foreground" : "bg-emerald-50/70 text-emerald-950"
              }`}
            >
              {isSkipped ? "无相关经历/数据（重写时用 XXX 占位）" : answer}
            </div>
          </article>
        )
      })}
    </div>
  )
}
