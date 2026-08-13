"use client"

import { useEffect, useState } from "react"
import { RefreshCw } from "lucide-react"
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
  getPersistedInterviewState,
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
  const [lastJd, setLastJd] = useState(() => getPersistedInputs().lastJd)
  const [resumePrompt, setResumePrompt] = useState<{
    kind: IncompleteSessionKind
    resumePhase: AgentPhase | null
  } | null>(null)

  const isStreaming = state.status === "streaming"
  const isAnalysisDone = state.status === "done" && !!state.persona && !!state.rewrite
  const scores = state.rewrite?.scores ?? null
  const showFallbackBanner = Boolean(state.usedFallback || state.streamInterrupted)

  // 硬刷新后恢复 lastJd，保证面试面板仍能拿到 JD
  useEffect(() => {
    const saved = getPersistedInputs().lastJd
    if (!lastJd && saved) setLastJd(saved)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 启动时检测未完成会话
  useEffect(() => {
    const incomplete = detectIncompleteSession()
    if (!incomplete) return

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
    // 仅挂载时检测一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleAnalyze = (jd: string, resume: string) => {
    setLastJd(jd)
    patchWorkspace({ inputs: { lastJd: jd } })
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

    // 面试练习进度已在 storage；确保完成态分析也已恢复
    const interview = getPersistedInterviewState()
    if (interview?.interview && state.status === "idle") {
      // agent 完成态由 hook 自己恢复
    }

    scrollToPhase(phase)
  }

  const handleDiscardSession = () => {
    clearWorkspace()
    reset()
    setLastJd("")
    setResumePrompt(null)
  }

  return (
    <div className="min-h-screen bg-mesh">
      <TopNav />
      {resumePrompt && (
        <ResumeSessionCard
          kind={resumePrompt.kind}
          resumePhase={resumePrompt.resumePhase}
          onContinue={handleContinueSession}
          onDiscard={handleDiscardSession}
        />
      )}
      <main className="mx-auto flex max-w-7xl flex-col px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
        <section className="mx-auto flex w-full max-w-3xl flex-col items-center text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/60 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
            <span
              className={`size-1.5 rounded-full ${isStreaming ? "animate-pulse bg-primary" : "bg-success"}`}
              aria-hidden="true"
            />
            {isStreaming ? "AI 正在分析…" : "AI 简历匹配引擎 · 实时分析"}
          </span>
          <HeroHeadline />
        </section>

        <section id="phase-analysis" className="mt-10 flex w-full flex-col gap-6">
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
            {/* 左侧：输入 / 预览 / 面试助手同列同宽，保证卡片左缘对齐 */}
            <div id="phase-C" className="flex w-full flex-col items-center">
              <HeroInput state={state} onAnalyze={handleAnalyze} />
              {isAnalysisDone && (
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
