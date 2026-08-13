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

interface InterviewPanelProps {
  jd: string
  persona: PersonaResult | null
  rewrite: RewriteResult | null
  isAnalyzing: boolean
}

export function InterviewPanel({ jd, persona, rewrite, isAnalyzing }: InterviewPanelProps) {
  const { state, startInterview, reset, submitAnswer } = useInterviewStream()
  // 已有完成结果时不自动弹窗；仅「尚未开始」时提示一次
  const [showPrompt, setShowPrompt] = useState(
    () => state.status === "idle",
  )
  const [starting, setStarting] = useState(false)
  const startLock = useRef(false)

  const bankCheck = useMemo(() => validateInterviewBank(), [])
  const bankReady = bankCheck.ok

  useEffect(() => {
    // 从模板页返回且面试已完成：保持结果展示，不要再弹「是否开始」
    if (state.status === "done") {
      setShowPrompt(false)
      return
    }
    if (persona && rewrite && !isAnalyzing && state.status === "idle") {
      setShowPrompt(true)
    }
  }, [persona, rewrite, isAnalyzing, state.status])

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
    setShowPrompt(false)
    try {
      await startInterview(jd, buildInterviewContext(persona, rewrite))
    } finally {
      setStarting(false)
      startLock.current = false
    }
  }

  const handleReset = () => {
    reset()
    setShowPrompt(true)
  }

  const startDisabled = !bankReady || starting || isStreaming

  return (
    // 与简历预览卡片同宽（max-w-4xl），放在左侧列内保证左右边线对齐
    <div id="phase-D" className="mt-6 w-full max-w-4xl text-left">
      {/* 开始前弹窗 */}
      {showPrompt && !hasStarted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-border/60 bg-card p-6 shadow-2xl">
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Sparkles className="size-6" aria-hidden="true" />
            </div>
            <h3 className="text-center text-lg font-semibold text-foreground">是否开始模拟面试</h3>
            <p className="mt-2 text-center text-sm leading-relaxed text-muted-foreground">
              你的预览简历已经生成完成。接下来将基于 JD 和优化后的简历，生成 3-5 道高频面试题与可练习的示范回答。
            </p>
            <div className="mt-6 flex items-center justify-center gap-3">
              <Button
                variant="outline"
                onClick={() => setShowPrompt(false)}
                className="rounded-full px-4"
              >
                暂不开始
              </Button>
              <span
                title={!bankReady ? "题库未就绪，请联系管理员" : undefined}
                className="inline-flex"
              >
                <Button
                  onClick={handleStart}
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
                  是，开始模拟面试
                </Button>
              </span>
            </div>
            {!bankReady && (
              <p className="mt-3 text-center text-xs text-muted-foreground">
                题库未就绪，请联系管理员
              </p>
            )}
          </div>
        </div>
      )}

      {/* 未开始：显示入口按钮 */}
      {!hasStarted && !showPrompt && (
        <div className="rounded-3xl border border-dashed border-primary/30 bg-primary/5 p-6 text-center">
          <Sparkles className="mx-auto mb-3 size-8 text-primary" aria-hidden="true" />
          <p className="text-base font-semibold text-foreground">准备好了？来模拟面试吧</p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            基于你的优化简历和 JD，AI 将生成 3-5 道高频面试题及完整示范话术
          </p>
          <span
            title={!bankReady ? "题库未就绪，请联系管理员" : undefined}
            className="mt-4 inline-flex"
          >
            <Button
              onClick={() => {
                if (!bankReady) return
                setShowPrompt(true)
              }}
              disabled={!bankReady}
              className={cn(
                "gap-2 rounded-full gradient-purple text-primary-foreground shadow-soft",
                !bankReady && "pointer-events-none opacity-50",
              )}
            >
              <Sparkles className="size-4" aria-hidden="true" />
              开始模拟面试
            </Button>
          </span>
          {!bankReady && (
            <p className="mt-2 text-xs text-muted-foreground">题库未就绪，请联系管理员</p>
          )}
        </div>
      )}

      {/* 加载中：不暴露模型原始结构化输出 */}
      {isStreaming && (
        <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-soft">
          <div className="flex items-center gap-2.5">
            <Loader2 className="size-5 animate-spin text-primary" aria-hidden="true" />
            <p className="text-sm font-medium">AI 面试官正在出题…</p>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            正在根据你的真实经历整理高频问题与示范回答
          </p>
        </div>
      )}

      {/* 错误 / 流中断：示例数据 + 重新生成 */}
      {isError && (
        <div className="rounded-3xl border border-destructive/30 bg-destructive/5 p-6 text-center">
          <AlertCircle className="mx-auto mb-3 size-8 text-destructive" aria-hidden="true" />
          <p className="text-sm font-medium text-destructive">
            {state.streamInterrupted ? "加载失败，已切换到示例数据" : "面试生成失败"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{state.error}</p>
          <Button
            onClick={handleStart}
            variant="outline"
            disabled={startDisabled}
            className={cn(
              "mt-4 gap-2 rounded-full",
              startDisabled && "pointer-events-none opacity-50",
            )}
          >
            <RefreshCw className="size-4" aria-hidden="true" />
            重新生成
          </Button>
        </div>
      )}

      {/* 结果展示 */}
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
                onClick={handleStart}
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
                <p className="text-xs text-muted-foreground">基于简历与 JD 生成</p>
              </div>
            </div>
            {/* 准备清单 */}
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

          {/* 面试题列表 */}
          <div>
            <div className="mb-3 flex items-center justify-between">
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
