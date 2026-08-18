"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AlertCircle, ClipboardList, Loader2, RefreshCw, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { InterviewCard } from "@/components/interview-card"
import { useInterviewStream } from "@/lib/hooks/use-interview-stream"
import { buildInterviewContext } from "@/lib/agent/interview-context"
import { validateInterviewBank } from "@/lib/agent/interview-fallback"
import type { PersonaResult, RewriteResult } from "@/lib/agent/types"
import { cn } from "@/lib/utils"
import { setInterviewPromptDismissed } from "@/lib/workspace-session"

interface InterviewPanelProps {
  jd: string
  persona: PersonaResult | null
  rewrite: RewriteResult | null
  isAnalyzing: boolean
}

export function InterviewPanel({ jd, persona, rewrite, isAnalyzing }: InterviewPanelProps) {
  const { state, startInterview, reset, submitAnswer } = useInterviewStream()
  const [starting, setStarting] = useState(false)
  const startLock = useRef(false)

  const bankCheck = useMemo(() => validateInterviewBank(), [])
  const bankReady = bankCheck.ok

  // 恢复到未完成作答的题目
  useEffect(() => {
    if (state.status !== "done" || !state.interview) return
    const index = state.progress.currentQuestionIndex
    if (index < 0) return
    const timer = window.setTimeout(() => {
      document.getElementById(`interview-q-${index}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      })
    }, 300)
    return () => window.clearTimeout(timer)
  }, [state.status, state.interview, state.progress.currentQuestionIndex])

  if (!persona || !rewrite || isAnalyzing) return null

  const hasStarted = state.status !== "idle"
  const isStreaming = state.status === "streaming"
  const isDone = state.status === "done" && state.interview
  const isError = state.status === "error"
  const showFallbackBanner = Boolean(state.usedFallback || state.streamInterrupted)

  const handleStart = async () => {
    if (!bankReady || startLock.current || starting || isStreaming) return
    startLock.current = true
    setStarting(true)
    setInterviewPromptDismissed(true)
    try {
      await startInterview(jd, buildInterviewContext(persona, rewrite))
    } finally {
      setStarting(false)
      startLock.current = false
    }
  }

  const handleReset = () => {
    reset()
    setInterviewPromptDismissed(false)
  }

  const startDisabled = !bankReady || starting || isStreaming

  return (
    <div id="phase-D" className="w-full text-left">
      {/* 未开始：卡片入口，不全屏弹窗挡操作 */}
      {!hasStarted && (
        <div className="rounded-3xl border border-dashed border-primary/30 bg-primary/5 p-5 text-center sm:p-6">
          <Sparkles className="mx-auto mb-3 size-8 text-primary" aria-hidden="true" />
          <p className="text-base font-semibold text-foreground">准备好了？来模拟面试吧</p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            基于你的优化简历和职位描述，AI 将生成 3-5 道高频面试题及完整示范话术
          </p>
          <span
            title={!bankReady ? "题库未就绪，请联系管理员" : undefined}
            className="mt-4 inline-flex"
          >
            <Button
              onClick={() => void handleStart()}
              disabled={startDisabled}
              className={cn(
                "gap-2 rounded-full gradient-purple text-primary-foreground shadow-soft",
                startDisabled && "pointer-events-none opacity-50",
              )}
            >
              {starting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Sparkles className="size-4" aria-hidden="true" />
              )}
              {starting ? "正在出题…" : "开始模拟面试"}
            </Button>
          </span>
          {!bankReady && (
            <p className="mt-2 text-xs text-muted-foreground">题库未就绪，请联系管理员</p>
          )}
        </div>
      )}

      {isStreaming && (
        <div className="rounded-3xl border border-border/60 bg-card p-6 text-center shadow-soft">
          <Loader2 className="mx-auto mb-3 size-5 animate-spin text-primary" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">正在根据简历与职位描述生成面试题…</p>
        </div>
      )}

      {isError && (
        <div className="rounded-3xl border border-destructive/30 bg-destructive/5 p-6 text-center">
          <AlertCircle className="mx-auto mb-3 size-8 text-destructive" aria-hidden="true" />
          <p className="text-sm text-destructive">{state.error || "生成失败"}</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-4 gap-1.5 rounded-full"
            onClick={() => void handleStart()}
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            重试
          </Button>
        </div>
      )}

      {isDone && state.interview && (
        <div className="space-y-4">
          {showFallbackBanner && (
            <div
              className="rounded-2xl border border-border/60 bg-muted/40 px-4 py-3 text-sm text-muted-foreground"
              role="status"
            >
              {state.streamInterrupted
                ? "加载失败，已切换到示例数据"
                : "AI 暂时不可用，已展示示例数据"}
              <Button
                onClick={() => void handleStart()}
                variant="ghost"
                size="sm"
                disabled={startDisabled}
                className={cn(
                  "ml-2 inline-flex gap-1.5 rounded-full text-xs",
                  startDisabled && "pointer-events-none",
                )}
              >
                <RefreshCw className="size-3.5" aria-hidden="true" />
                重新生成
              </Button>
            </div>
          )}

          <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-soft">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ClipboardList className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-medium">面试准备清单</p>
                <p className="text-xs text-muted-foreground">基于简历与职位描述生成</p>
              </div>
            </div>
            {state.interview.preparationChecklist.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-xs font-medium text-primary">📋 面试前准备清单</p>
                <ul className="space-y-1.5">
                  {state.interview.preparationChecklist.map((item, i) => (
                    <li key={`${item}-${i}`} className="flex gap-2 text-sm text-foreground">
                      <span className="text-primary">○</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">
                高频面试题预测（{state.interview.questions.length} 题）
              </p>
              <Button
                onClick={handleReset}
                variant="ghost"
                size="sm"
                className="gap-1.5 rounded-full text-xs"
              >
                <RefreshCw className="size-3.5" aria-hidden="true" />
                重新生成
              </Button>
            </div>
            <div className="space-y-3">
              {state.interview.questions.map((q, i) => (
                <InterviewCard
                  key={q.id ?? i}
                  question={q}
                  index={i}
                  initialAnswer={state.progress.answers[q.id] ?? ""}
                  submitted={state.progress.submittedQuestionIds.includes(q.id)}
                  onSubmitAnswer={submitAnswer}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
