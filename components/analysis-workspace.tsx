"use client"

import { useEffect, useState } from "react"
import { Eraser, RefreshCw } from "lucide-react"
import { TopNav } from "@/components/top-nav"
import { HeroInput } from "@/components/hero-input"
import { InterviewPanel } from "@/components/interview-panel"
import { MatchScoreCard } from "@/components/match-score-card"
import { KeywordGapCard } from "@/components/keyword-gap-card"
import { StrengthWeaknessCard } from "@/components/strength-weakness-card"
import { PersonaCard } from "@/components/persona-card"
import { ResumeSessionCard } from "@/components/resume-session-card"
import { Button } from "@/components/ui/button"
import { useAgentStream } from "@/lib/hooks/use-agent-stream"
import {
  clearWorkspace,
  detectIncompleteSession,
  getIncompleteAgentState,
  getPersistedInputs,
  patchWorkspace,
  type IncompleteSessionKind,
} from "@/lib/workspace-session"
import { HeroHeadline } from "@/components/hero-headline"
import type { AgentPhase } from "@/lib/agent/types"
import {
  getFallbackOutline,
  getFallbackPersona,
  getFallbackRewrite,
} from "@/lib/agent/fallback-content"

export function AnalysisWorkspace() {
  const { state, analyze, reset, setState } = useAgentStream()
  const [lastJd, setLastJd] = useState("")
  const [resumePrompt, setResumePrompt] = useState<{
    kind: IncompleteSessionKind
    resumePhase: AgentPhase | null
  } | null>(null)
  const [sessionReady, setSessionReady] = useState(false)

  const isStreaming = state.status === "streaming"
  const isAnalysisDone = state.status === "done" && !!state.persona && !!state.rewrite
  const scores = state.rewrite?.scores ?? null
  const showFallbackBanner = Boolean(state.usedFallback || state.streamInterrupted)

  // 挂载后再恢复 lastJd，避免与 SSR 首屏不一致
  useEffect(() => {
    const saved = getPersistedInputs().lastJd
    if (saved) setLastJd(saved)
  }, [])

  // 启动时检测可恢复会话（含已完成分析）
  useEffect(() => {
    const incomplete = detectIncompleteSession()
    if (!incomplete) {
      setSessionReady(true)
      return
    }

    // 若分析未完成，先把可恢复的中间态灌入 UI（避免卡在假 streaming）
    const partial = getIncompleteAgentState()
    if (partial && state.status === "idle") {
      const hasComplete = Boolean(partial.rewrite && partial.persona)
      if (hasComplete) {
        setState({
          ...partial,
          status: "done",
          streamInterrupted: partial.status === "streaming" || partial.status === "error",
        })
      } else if (partial.persona || partial.outline || partial.rewrite) {
        setState({
          ...partial,
          status: "done",
          persona: partial.persona ?? getFallbackPersona(),
          outline: partial.outline ?? getFallbackOutline(),
          rewrite: partial.rewrite ?? getFallbackRewrite(),
          streamInterrupted: true,
          usedFallback: true,
          source: "fallback",
          error: null,
        })
      }
    }

    setResumePrompt({
      kind: incomplete.kind,
      resumePhase: incomplete.resumePhase,
    })
    // 有恢复弹窗时先挡住操作，等用户选择
    setSessionReady(incomplete.kind !== "done" && incomplete.kind !== "analysis")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleAnalyze = (jd: string, resume: string) => {
    setLastJd(jd)
    patchWorkspace({
      inputs: { lastJd: jd },
      ui: { interviewPromptDismissed: false },
    })
    analyze(jd, resume)
  }

  const scrollToPhase = (phase: AgentPhase | null) => {
    if (!phase) return
    const id = phase === "D" ? "phase-D" : phase === "C" ? "phase-C" : "phase-analysis"
    window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 150)
  }

  const handleContinueSession = () => {
    const phase = resumePrompt?.resumePhase ?? null
    setResumePrompt(null)
    setSessionReady(true)
    scrollToPhase(phase)
  }

  const handleDiscardSession = () => {
    clearWorkspace()
    reset()
    setLastJd("")
    setResumePrompt(null)
    setSessionReady(true)
  }

  const handleClearWorkspace = () => {
    if (
      typeof window !== "undefined" &&
      !window.confirm("确定清空本机工作台？将删除当前分析结果与面试进度。")
    ) {
      return
    }
    handleDiscardSession()
  }

  return (
    <div className="min-h-screen bg-mesh">
      <TopNav onClearWorkspace={handleClearWorkspace} />
      {resumePrompt && (
        <ResumeSessionCard
          kind={resumePrompt.kind}
          resumePhase={resumePrompt.resumePhase}
          onContinue={handleContinueSession}
          onDiscard={handleDiscardSession}
        />
      )}
      <main className="mx-auto flex max-w-7xl flex-col px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-16">
        <section className="mx-auto flex w-full max-w-3xl flex-col items-center text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/60 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
            <span
              className={`size-1.5 rounded-full ${isStreaming ? "animate-pulse bg-primary" : "bg-success"}`}
              aria-hidden="true"
            />
            {isStreaming ? "AI 正在分析…" : "AI 简历匹配引擎 · 实时分析"}
          </span>
          <HeroHeadline />
          {(isAnalysisDone || Boolean(lastJd)) && sessionReady && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-4 gap-1.5 rounded-full text-xs text-muted-foreground"
              onClick={handleClearWorkspace}
            >
              <Eraser className="size-3.5" aria-hidden="true" />
              清空工作台
            </Button>
          )}
        </section>

        <section id="phase-analysis" className="mt-8 flex w-full flex-col gap-6 sm:mt-10">
          {showFallbackBanner && (
            <div
              className="mx-auto flex w-full max-w-4xl flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-muted/40 px-4 py-3 text-sm text-muted-foreground"
              role="status"
            >
              <span>
                {state.streamInterrupted
                  ? "加载失败，已切换到示例数据"
                  : "AI 暂时不可用，已展示示例数据"}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1.5 rounded-full text-xs"
                onClick={() => {
                  const inputs = getPersistedInputs()
                  if (inputs.jd.trim()) {
                    handleAnalyze(inputs.jd.trim(), inputs.resume.trim())
                  }
                }}
              >
                <RefreshCw className="size-3.5" aria-hidden="true" />
                重新生成
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_400px] lg:items-start">
            <div id="phase-C" className="flex w-full min-w-0 flex-col items-center">
              <HeroInput state={state} onAnalyze={handleAnalyze} />
              {isAnalysisDone && sessionReady && (
                <InterviewPanel
                  jd={lastJd}
                  persona={state.persona}
                  rewrite={state.rewrite}
                  isAnalyzing={isStreaming}
                />
              )}
            </div>

            <aside className="space-y-4 self-start pt-0" aria-label="数据看板">
              <PersonaCard persona={state.persona} isLoading={isStreaming} />
              <MatchScoreCard scores={scores} isLoading={isStreaming} />
              <KeywordGapCard
                keywordAnalysis={scores?.keywordAnalysis ?? null}
                isLoading={isStreaming}
              />
              <StrengthWeaknessCard scores={scores} isLoading={isStreaming} />
            </aside>
          </div>
        </section>
      </main>
    </div>
  )
}
