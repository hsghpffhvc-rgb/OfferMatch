"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  HelpCircle,
  Lightbulb,
  Loader2,
  RefreshCw,
  SkipForward,
  Sparkles,
  Target,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { useEvidenceGap } from "@/lib/hooks/use-evidence-gap"
import { DIMENSIONS, type OutlineResult, type PersonaResult } from "@/lib/agent/types"
import { cn } from "@/lib/utils"

interface EvidenceGapPanelProps {
  analysisId?: string
  jd: string
  persona: PersonaResult | null
  outline: OutlineResult | null
  resume: string
  isAnalyzing: boolean
  isRewriting: boolean
  onApplied: (evidenceText: string) => void
}

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

const AUTO_START_THRESHOLD = 3

export function EvidenceGapPanel({
  analysisId,
  jd,
  persona,
  outline,
  resume,
  isAnalyzing,
  isRewriting,
  onApplied,
}: EvidenceGapPanelProps) {
  const { state, startGaps, setAnswer, commitAnswer, skipGap, markSubmitted, reset } = useEvidenceGap()
  const router = useRouter()
  const [dismissed, setDismissed] = useState(false)
  const [openHints, setOpenHints] = useState<Record<string, boolean>>({})

  const autoStartedRef = useRef<string | null>(null)

  const gapCandidates = state.gaps.length > 0 ? state.gaps.length : 0
  const isPreparing = state.status === "loading"
  const answeredCount = state.gaps.filter(
    (gap) => (state.answers[gap.id] ?? "").trim().length > 0,
  ).length
  const skippedCount = state.skippedGapIds.length
  const pendingCount = state.gaps.length - answeredCount - skippedCount

  const performStart = useCallback(() => {
    if (!persona) return
    void startGaps({ jd, persona, resume, analysisId })
  }, [analysisId, jd, persona, resume, startGaps])

  useEffect(() => {
    if (isAnalyzing || !persona || dismissed) return
    if (state.status !== "idle") return
    if (autoStartedRef.current === (analysisId ?? "anonymous")) return
    autoStartedRef.current = analysisId ?? "anonymous"
    performStart()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAnalyzing, persona, state.status, dismissed])

  if (!persona) return null
  // 重写进行中隐藏交互区；已提交时仍保留折叠摘要卡
  if (isAnalyzing && !state.submitted) return null

  const hasGaps = state.gaps.length > 0
  const showEntry = !dismissed && state.status === "idle"
  const showNoGapHint = !dismissed && state.status === "idle" && !hasGaps

  if (showNoGapHint) return null

  const buildEvidenceText = (): string => {
    const lines: string[] = []
    lines.push("【用户补充的证据】")
    for (const gap of state.gaps) {
      const skipped = state.skippedGapIds.includes(gap.id)
      const answer = (state.answers[gap.id] ?? "").trim()
      lines.push(`- 追问：${gap.question}（关键词：${gap.keyword}）`)
      if (skipped || !answer) {
        lines.push("  回答：无相关经历/数据（该缺口请用 XXX 占位，不得编造）")
      } else {
        lines.push(`  回答：${answer}`)
      }
    }
    return lines.join("\n")
  }

  const handleSubmit = () => {
    const text = buildEvidenceText()
    markSubmitted()
    onApplied(text)
  }

  const canSubmit = state.status === "questions" && hasGaps && !isRewriting

  return (
    <section className="w-full text-left" id="phase-C">
      <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Target className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-medium">补齐缺失的匹配证据（重写前）</p>
              <p className="text-xs text-muted-foreground">
                先确认你是否有相关经历/数据，再生成简历，避免凭空编造
              </p>
            </div>
          </div>
          {!state.submitted && hasGaps && (
            <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-foreground">
              已回答 {answeredCount}/{state.gaps.length}
              {skippedCount > 0 ? ` · 跳过 ${skippedCount}` : ""}
            </span>
          )}
        </div>

        {state.submitted && (
          <div className="mt-4 rounded-2xl border border-emerald-200/80 bg-emerald-50/70 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-950">
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                  阶段C 证据补足已提交
                </p>
                <p className="mt-1 text-xs leading-relaxed text-emerald-900/80">
                  已提交 {answeredCount} 条证据，{skippedCount} 条标记为「无相关经历/数据」（重写时将用 XXX 占位）。
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 rounded-full"
                onClick={() => router.push("/evidence")}
              >
                <ExternalLink className="size-3.5" aria-hidden="true" />
                查看详情
              </Button>
            </div>
          </div>
        )}

        {showEntry && !state.submitted && (
          <div className="mt-4 rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-4">
            <p className="text-sm font-medium text-foreground">检测到证据缺口，先补事实再重写</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              为避免编造，AI 会先追问你是否有相关经历与数据。没有的直接选「无相关经历/数据」，重写时会用 XXX 占位。
            </p>
            <Button
              onClick={performStart}
              className="mt-3 gap-2 rounded-full gradient-purple text-primary-foreground shadow-soft"
            >
              <Sparkles className="size-4" aria-hidden="true" />
              开始证据收集
            </Button>
          </div>
        )}

        {isPreparing && !state.submitted && (
          <div className="mt-4 flex items-center gap-2.5 rounded-2xl bg-muted/30 p-4">
            <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">正在从 JD 与原始简历里定位证据缺口…</p>
          </div>
        )}

        {state.error && !state.submitted && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3">
            <p className="flex items-center gap-2 text-xs text-destructive" role="alert">
              <AlertCircle className="size-4" aria-hidden="true" />
              {state.error}
            </p>
          </div>
        )}

        {state.usedFallback && hasGaps && !state.submitted && (
          <div className="mt-4 rounded-2xl border border-border/60 bg-muted/40 px-4 py-3 text-xs text-muted-foreground" role="status">
            AI 暂时不可用，已展示示例追问
            <Button variant="ghost" size="sm" onClick={performStart} className="ml-2 gap-1.5 rounded-full text-xs">
              <RefreshCw className="size-3.5" aria-hidden="true" />
              重新生成
            </Button>
          </div>
        )}

        {state.coachingNote && hasGaps && !isPreparing && !state.submitted && (
          <p className="mt-3 text-xs text-muted-foreground">{state.coachingNote}</p>
        )}

        {state.status === "questions" && hasGaps && !state.submitted && (
          <div className="mt-4 space-y-3">
            {state.gaps.map((gap, index) => {
              const severity = SEVERITY_META[gap.severity] ?? SEVERITY_META.important
              const skipped = state.skippedGapIds.includes(gap.id)
              const hintsOpen = Boolean(openHints[gap.id])
              return (
                <div
                  key={gap.id}
                  className={cn("rounded-2xl border border-border/60 bg-background/60 p-4", skipped && "opacity-60")}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset", severity.className)}>
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

                  <button
                    type="button"
                    onClick={() => setOpenHints((prev) => ({ ...prev, [gap.id]: !prev[gap.id] }))}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                  >
                    <Lightbulb className="size-3.5" aria-hidden="true" />
                    {hintsOpen ? "收起回答提示" : "不知道怎么答？看提示"}
                  </button>

                  {hintsOpen && gap.answerHints.length > 0 && (
                    <ul className="mt-2 space-y-1 rounded-xl bg-muted/30 p-2.5">
                      {gap.answerHints.map((hint) => (
                        <li key={hint} className="flex gap-1.5 text-xs text-muted-foreground">
                          <HelpCircle className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                          {hint}
                        </li>
                      ))}
                    </ul>
                  )}

                  <textarea
                    value={state.answers[gap.id] ?? ""}
                    onChange={(event) => setAnswer(gap.id, event.target.value)}
                    onBlur={() => commitAnswer(gap.id)}
                    rows={3}
                    placeholder="按你真实经历写就好，不用润色；没有相关经历就点下方「无相关经历/数据」"
                    disabled={isRewriting}
                    className="mt-3 w-full resize-y rounded-xl border border-border/70 bg-card px-3 py-2 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:opacity-60"
                  />

                  <div className="mt-2 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => skipGap(gap.id)}
                      disabled={isRewriting}
                      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                    >
                      <SkipForward className="size-3.5" aria-hidden="true" />
                      {skipped ? "已标记：无相关经历/数据" : "无相关经历/数据"}
                    </button>
                    {(state.answers[gap.id] ?? "").trim().length > 0 && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600">
                        <CheckCircle2 className="size-3.5" aria-hidden="true" />
                        已作答
                      </span>
                    )}
                  </div>
                </div>
              )
            })}

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">
                {pendingCount > 0
                  ? `还有 ${pendingCount} 题未处理，也可以先提交已答的部分`
                  : "都处理完了，可以开始重写简历"}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setDismissed(true)} className="rounded-full text-xs">
                  稍后再说
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className="gap-2 rounded-full gradient-purple text-primary-foreground shadow-soft"
                >
                  {isRewriting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                      正在重写简历…
                    </>
                  ) : (
                    <>
                      提交证据并重写简历
                      <ArrowRight className="size-4" aria-hidden="true" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
