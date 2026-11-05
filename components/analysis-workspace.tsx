"use client"

import { useEffect, useState } from "react"
import { Eraser, RefreshCw } from "lucide-react"
import { TopNav } from "@/components/top-nav"
import { HeroInput } from "@/components/hero-input"
import { InterviewPanel } from "@/components/interview-panel"
import { EvidenceGapPanel } from "@/components/evidence-gap-panel"
import { ResumeAuditCard } from "@/components/resume-audit-card"
import { MatchScoreCard } from "@/components/match-score-card"
import { KeywordGapCard } from "@/components/keyword-gap-card"
import { StrengthWeaknessCard } from "@/components/strength-weakness-card"
import { PersonaCard } from "@/components/persona-card"
import { ResumeSessionCard } from "@/components/resume-session-card"
import { Button } from "@/components/ui/button"
import { useAgentStream } from "@/lib/hooks/use-agent-stream"
import type { InterviewStatus } from "@/lib/hooks/use-interview-stream"
import {
  clearWorkspace,
  clearEvidenceInWorkspace,
  consumeResumePromptSuppression,
  detectPendingSession,
  getIncompleteAgentState,
  getPersistedAgentState,
  getPersistedEvidenceState,
  getPersistedInputs,
  getPersistedInterviewState,
  patchWorkspace,
  type IncompleteSessionKind,
} from "@/lib/workspace-session"
import { HeroHeadline } from "@/components/hero-headline"
import { buildEvidenceTextFromState } from "@/lib/agent/evidence-gap"
import { recoverResumeBasics } from "@/lib/agent/resume-continuity"
import { renderResumeMarkdown } from "@/lib/agent/rewrite-quality"
import type { AgentPhase, OutlineResult } from "@/lib/agent/types"
import {
  getFallbackOutline,
  getFallbackPersona,
} from "@/lib/agent/fallback-content"
import { AnalyticsEvent, track } from "@/lib/analytics"

export function AnalysisWorkspace() {
  const { state, analyze, rewriteResume, reset, setState } = useAgentStream()
  const [lastJd, setLastJd] = useState("")
  const [lastResume, setLastResume] = useState(() => getPersistedInputs().resume)
  const [resumePrompt, setResumePrompt] = useState<{
    kind: IncompleteSessionKind
    resumePhase: AgentPhase | null
  } | null>(null)
  const [sessionReady, setSessionReady] = useState(false)
  const [inputsResetKey, setInputsResetKey] = useState(0)
  const [interviewStatus, setInterviewStatus] = useState<InterviewStatus>("idle")

  useEffect(() => {
    const saved = getPersistedInterviewState()
    if (saved?.status) setInterviewStatus(saved.status)
  }, [])

  const isStreaming = state.status === "streaming"
  const isEvidenceReady = state.status === "done" && !!state.persona && !!state.outline && !state.rewrite

  const [evidenceSubmitted, setEvidenceSubmitted] = useState(false)
  useEffect(() => {
    const saved = getPersistedEvidenceState()
    setEvidenceSubmitted(Boolean(saved?.submitted))
  }, [state.rewrite, state.persona, state.outline, state.status])

  // 重写缺失或校验未通过（draft）时，都提供直接重跑的入口
  const draftIssues = state.rewrite?.verification?.status === "draft"
    ? (state.rewrite.verification.issues ?? []).filter((issue) => issue.severity === "error")
    : []
  const hasLegacyPlaceholder = /XXX|×××/.test(state.rewrite?.rewrittenResumeMarkdown ?? "")
  const needsRewriteRetry =
    evidenceSubmitted
    && Boolean(state.persona && state.outline)
    && (!state.rewrite || draftIssues.length > 0 || hasLegacyPlaceholder)
    && !isStreaming
  const isAnalysisDone = state.status === "done" && !!state.persona && !!state.rewrite
  const scores = state.rewrite?.scores ?? null
  const showFallbackBanner = Boolean(state.usedFallback || state.streamInterrupted)

  // 记录首页访问（漏斗入口）
  useEffect(() => {
    track(AnalyticsEvent.homeViewed, {})
    // 仅挂载时记一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 挂载后再恢复 lastJd，避免与 SSR 首屏不一致
  useEffect(() => {
    const saved = getPersistedInputs().lastJd
    if (saved) setLastJd(saved)
  }, [])

  // Existing results may have been saved before missing basics were recovered.
  // Only add fields that can still be verified against the saved source resume.
  useEffect(() => {
    if (!state.rewrite || !state.persona || !lastResume.trim()) return
    const current = state.rewrite.resume.basics
    const recovered = recoverResumeBasics(current, lastResume, state.persona.resumeSnapshot)
    if (JSON.stringify(current) === JSON.stringify(recovered)) return
    setState((prev) => {
      if (!prev.rewrite || prev.rewrite !== state.rewrite) return prev
      const resume = { ...prev.rewrite.resume, basics: recovered }
      return { ...prev, rewrite: { ...prev.rewrite, resume, rewrittenResumeMarkdown: renderResumeMarkdown(resume) } }
    })
  }, [state.rewrite, state.persona, lastResume, setState])

  // 启动时恢复工作区：正常中间态直接静默恢复，只有真正中断才询问
  useEffect(() => {
    consumeResumePromptSuppression()

    const doneAgent = getPersistedAgentState()
    if (doneAgent) {
      setState({ ...doneAgent, status: "done" })
    } else {
      const partial = getIncompleteAgentState()
      if (partial) {
        const interrupted = partial.status === "streaming" || partial.status === "error"
        if (partial.rewrite && partial.persona) {
          setState({ ...partial, status: "done", streamInterrupted: interrupted })
        } else if (partial.persona && partial.outline) {
          // A/B 已完成、阶段 C/D 未完成：这是新流程的正常中间态，不伪造重写结果也不弹窗
          setState({
            ...partial,
            status: "done",
            rewrite: partial.rewrite ?? null,
            streamInterrupted: interrupted,
            usedFallback: false,
            error: null,
          })
        } else if (partial.persona || partial.outline || partial.rewrite) {
          setState({
            ...partial,
            status: "done",
            persona: partial.persona ?? getFallbackPersona(),
            outline: partial.outline ?? getFallbackOutline(),
            rewrite: partial.rewrite ?? null,
            streamInterrupted: true,
            usedFallback: true,
            source: "fallback",
            error: null,
          })
        }
      }
    }

    setSessionReady(true)
    const pending = detectPendingSession()
    setResumePrompt(
      pending ? { kind: pending.kind, resumePhase: pending.resumePhase } : null,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleAnalyze = (jd: string, resume: string) => {
    setLastJd(jd)
    setLastResume(resume)
    setInterviewStatus("idle")
    patchWorkspace({
      inputs: { lastJd: jd, jd, resume },
      ui: { interviewPromptDismissed: false },
    })
    // 新一轮分析：上一轮的证据追问不能串到新 JD 上
    clearEvidenceInWorkspace()
    analyze(jd, resume)
  }

  const handleEvidenceSubmit = (evidenceText: string) => {
    if (!state.persona || !state.outline) return
    void rewriteResume({
      jd: lastJd,
      persona: state.persona,
      outline: state.outline,
      resume: lastResume,
      evidence: evidenceText,
      analysisId: state.analysisId,
    })
  }

  const handleRetryRewrite = () => {
    const saved = getPersistedEvidenceState()
    if (!saved) return
    const text = buildEvidenceTextFromState({
      gaps: saved.gaps,
      answers: saved.answers,
      skippedGapIds: saved.skippedGapIds,
    })
    handleEvidenceSubmit(text)
  }

  const scrollToPhase = (phase: AgentPhase | null) => {
    if (!phase) return
    const id =
      phase === "E"
        ? "phase-E"
        : phase === "D"
          ? "phase-D"
          : phase === "C"
            ? "phase-C"
            : "phase-analysis"
    window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
    }, 150)
  }

  const handleContinueSession = () => {
    const phase = resumePrompt?.resumePhase ?? null
    const kind = resumePrompt?.kind
    setResumePrompt(null)
    setSessionReady(true)

    // A/B 被打断时服务端没有可恢复的中间产物，用已保存的输入重跑一遍才算真正「继续」
    if (kind === "analysis") {
      const inputs = getPersistedInputs()
      if (inputs.jd.trim()) {
        handleAnalyze(inputs.jd.trim(), inputs.resume.trim())
        return
      }
    }
    scrollToPhase(phase)
  }

  const handleDiscardSession = () => {
    clearWorkspace()
    reset()
    setLastJd("")
    setResumePrompt(null)
    setSessionReady(true)
    setInputsResetKey((key) => key + 1)
  }

  const handleClearWorkspace = () => {
    if (
      typeof window !== "undefined" &&
      !window.confirm("确定清空本机工作台？将删除当前分析结果、面试进度以及已填写的职位描述和简历。")
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

          <div className="w-full">
            <HeroInput
              state={state}
              onAnalyze={handleAnalyze}
              resetKey={inputsResetKey}
              interviewStatus={interviewStatus}
            >
              {({ composer, phaseProgress, resumeMarkdown, resumePdf }) => (
                <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[1fr_400px] lg:items-start">
                  <div className="order-1 flex min-w-0 flex-col gap-3 lg:col-start-1 lg:row-start-1">
                    {composer}
                    {phaseProgress}
                    {state.persona && state.outline && sessionReady ? (
                      <EvidenceGapPanel
                        analysisId={state.analysisId}
                        jd={lastJd}
                        persona={state.persona}
                        outline={state.outline}
                        resume={lastResume}
                        isAnalyzing={isStreaming}
                        isRewriting={isStreaming && state.currentPhase === "D"}
                        onApplied={handleEvidenceSubmit}
                      />
                    ) : null}
                  </div>
                  <PersonaCard
                    persona={state.persona}
                    isLoading={isStreaming}
                    className="order-5 h-full lg:col-start-2 lg:row-start-1"
                  />

                  {/* 左：重写简历 | 右：整体匹配度（同一行顶对齐） */}
                  <div id="phase-D" className="order-3 min-w-0 lg:col-start-1 lg:row-start-2">
                    {needsRewriteRetry ? (
                      <div className="rounded-3xl border border-amber-300/60 bg-amber-50/70 p-4">
                        <p className="text-sm font-medium text-amber-950">
                          {state.rewrite ? "阶段D 简历需要重新生成" : "阶段D 简历重写未完成"}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-amber-900/80">
                          {draftIssues.length > 0
                            ? draftIssues.map((issue) => issue.message).join("；")
                            : hasLegacyPlaceholder
                              ? "当前简历正文仍有 XXX 占位，需要重新生成并核对。"
                              : "证据已提交，但重写没有成功返回（可能是超时或网络中断）。"}
                          重试会沿用你已经补好的证据，无需重新填写。
                        </p>
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleRetryRewrite}
                          className="mt-3 gap-1.5 rounded-full gradient-purple text-primary-foreground shadow-soft"
                        >
                          <RefreshCw className="size-3.5" aria-hidden="true" />
                          重新执行重写
                        </Button>
                      </div>
                    ) : null}
                    {resumeMarkdown}
                  </div>
                  <div className="order-6 min-w-0 lg:col-start-2 lg:row-start-2">
                    <MatchScoreCard scores={scores} isLoading={isStreaming} />
                  </div>

                  {/* 左：PDF + 模拟面试（同宽）；右：关键词 + 亮点短板 */}
                  <div className="order-4 flex min-w-0 flex-col gap-4 lg:col-start-1 lg:row-start-3">
                    {resumePdf}
                    {isAnalysisDone && sessionReady ? (
                      <div id="phase-E">
                      <InterviewPanel
                        analysisId={state.analysisId}
                        jd={lastJd}
                        persona={state.persona}
                        rewrite={state.rewrite}
                        isAnalyzing={isStreaming}
                        onStatusChange={setInterviewStatus}
                      />
                      </div>
                    ) : null}
                  </div>
                  <div className="order-7 flex min-w-0 flex-col gap-6 lg:col-start-2 lg:row-start-3">
                    {state.rewrite ? <ResumeAuditCard rewrite={state.rewrite} /> : null}
                    <KeywordGapCard
                      keywordAnalysis={scores?.keywordAnalysis ?? null}
                      isLoading={isStreaming}
                    />
                    <StrengthWeaknessCard scores={scores} isLoading={isStreaming} />
                  </div>
                </div>
              )}
            </HeroInput>
          </div>
        </section>
      </main>
    </div>
  )
}
