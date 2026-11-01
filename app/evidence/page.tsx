"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, CheckCircle2, Loader2, Target } from "lucide-react"
import { DIMENSIONS } from "@/lib/agent/types"
import { getPersistedEvidenceState, type PersistedEvidenceState } from "@/lib/workspace-session"

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

export default function EvidenceDetailPage() {
  const [evidence, setEvidence] = useState<PersistedEvidenceState | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setEvidence(getPersistedEvidenceState())
    setReady(true)
  }, [])

  const gaps = evidence?.gaps ?? []
  const answers = evidence?.answers ?? {}
  const skipped = evidence?.skippedGapIds ?? []
  const answeredCount = gaps.filter((gap) => (answers[gap.id] ?? "").trim().length > 0).length

  return (
    <div className="min-h-screen bg-mesh">
      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            返回主界面
          </Link>
        </div>

        <header className="mt-4 flex items-start gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Target className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-lg font-semibold text-foreground">阶段C · 简历匹配证据补足详情</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              这里记录了你补充的经历与数据。未提供或标记为「无相关经历/数据」的缺口，重写简历时会用 XXX 占位，不会编造。
            </p>
          </div>
        </header>

        {!ready && (
          <div className="mt-6 flex items-center gap-2.5 rounded-2xl bg-muted/30 p-4">
            <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">正在读取证据记录…</p>
          </div>
        )}

        {ready && gaps.length === 0 && (
          <div className="mt-6 rounded-2xl border border-dashed border-border/70 bg-card/60 p-6 text-center">
            <p className="text-sm text-muted-foreground">暂无证据补足记录，请先回到主界面完成阶段C。</p>
            <Link
              href="/"
              className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-medium text-primary-foreground"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              返回主界面
            </Link>
          </div>
        )}

        {gaps.length > 0 && (
          <>
            <div className="mt-5 flex flex-wrap items-center gap-2 rounded-2xl bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
              <CheckCircle2 className="size-4 text-emerald-600" aria-hidden="true" />
              共 {gaps.length} 个缺口，已回答 {answeredCount} 条，标记无相关经历 {skipped.length} 条
            </div>

            <div className="mt-4 space-y-3">
              {gaps.map((gap, index) => {
                const severity = SEVERITY_META[gap.severity] ?? SEVERITY_META.important
                const answer = (answers[gap.id] ?? "").trim()
                const isSkipped = skipped.includes(gap.id) || !answer
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
                        isSkipped
                          ? "bg-muted/40 text-muted-foreground"
                          : "bg-emerald-50/70 text-emerald-950"
                      }`}
                    >
                      {isSkipped ? "无相关经历/数据（重写时用 XXX 占位）" : answer}
                    </div>
                  </article>
                )
              })}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
