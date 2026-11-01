"use client"

import { useEffect, useState } from "react"
import type { AgentPhase } from "@/lib/agent/types"
import type { AgentStreamState } from "@/lib/hooks/use-agent-stream"
import type { InterviewStatus } from "@/lib/hooks/use-interview-stream"
import { getPersistedEvidenceState } from "@/lib/workspace-session"
import { CheckCircle2, Circle, Loader2, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

const PHASES: AgentPhase[] = ["A", "B", "C", "D", "E"]

const phaseCompleteCopy: Record<AgentPhase, string> = {
  A: "阶段A 职位要求深度解析已完成",
  B: "阶段B 逆向推导已完成理想简历大纲",
  C: "阶段C 简历匹配证据补足已完成",
  D: "阶段D 简历差异化重写已完成，各项评分已生成",
  E: "阶段E 模拟面试题与示范回答已生成",
}

const phaseActiveCopy: Record<AgentPhase, string> = {
  A: "正在解析职位要求，提炼理想候选人画像…",
  B: "正在逆向推导理想简历大纲…",
  C: "正在定位并追问缺失的匹配证据…",
  D: "正在差异化重写简历并生成各项评分…",
  E: "正在生成模拟面试题与示范回答…",
}

const phasePendingCopy: Record<AgentPhase, string> = {
  A: "阶段A · 职位要求深度解析",
  B: "阶段B · 逆向推导理想简历大纲",
  C: "阶段C · 简历匹配证据补足",
  D: "阶段D · 简历差异化重写",
  E: "阶段E · 模拟面试题与示范回答",
}

const phaseCActionCopy = "阶段C 简历匹配证据补足，请补充缺失的经历与数据"
const phaseEWaitingCopy = "阶段E 模拟面试题与示范回答点击开始后运行"

type StepStatus = "pending" | "active" | "complete" | "action"

interface PhaseProgressPanelProps {
  state: AgentStreamState
  interviewStatus?: InterviewStatus
}

function isPhaseComplete(
  phase: AgentPhase,
  state: AgentStreamState,
  evidenceSubmitted: boolean,
): boolean {
  if (phase === "A") return Boolean(state.persona)
  if (phase === "B") return Boolean(state.outline)
  if (phase === "C") return evidenceSubmitted
  if (phase === "D") return Boolean(state.rewrite)
  if (phase === "E") return false
  return false
}

function resolveStep(
  phase: AgentPhase,
  state: AgentStreamState,
  interviewStatus: InterviewStatus,
  evidenceSubmitted: boolean,
): { status: StepStatus; label: string } {
  const streaming = state.status === "streaming"

  if (phase === "E") {
    if (interviewStatus === "done" && state.rewrite) {
      return { status: "complete", label: phaseCompleteCopy.E }
    }
    if (interviewStatus === "streaming") {
      return { status: "active", label: phaseActiveCopy.E }
    }
    if (interviewStatus === "error") {
      return { status: "action", label: phaseEWaitingCopy }
    }
    if (state.rewrite && evidenceSubmitted) {
      return { status: "action", label: phaseEWaitingCopy }
    }
    return { status: "pending", label: phasePendingCopy.E }
  }

  if (isPhaseComplete(phase, state, evidenceSubmitted)) {
    return { status: "complete", label: phaseCompleteCopy[phase] }
  }

  if (streaming && state.currentPhase === phase) {
    return { status: "active", label: state.phaseMessage?.trim() || phaseActiveCopy[phase] }
  }

  // 阶段 C 是用户的动作点：A/B 完成后等待补证
  if (phase === "C" && state.persona && state.outline && !state.rewrite) {
    return { status: "action", label: phaseCActionCopy }
  }

  return { status: "pending", label: phasePendingCopy[phase] }
}

export function PhaseProgressPanel({
  state,
  interviewStatus = "idle",
}: PhaseProgressPanelProps) {
  const [evidenceSubmitted, setEvidenceSubmitted] = useState(false)

  useEffect(() => {
    const saved = getPersistedEvidenceState()
    setEvidenceSubmitted(Boolean(saved?.submitted))
  }, [state.rewrite, state.persona, state.outline])

  const visible =
    state.status === "streaming"
    || state.status === "done"
    || state.status === "error"
    || Boolean(state.persona || state.outline || state.rewrite)

  if (!visible) return null

  return (
    <div className="w-full text-left" aria-live="polite" aria-label="分析阶段进度">
      <ul className="flex flex-col gap-2">
        {PHASES.map((phase) => {
          const step = resolveStep(phase, state, interviewStatus, evidenceSubmitted)
          return (
            <li
              key={phase}
              className={cn(
                "flex items-start gap-2.5 rounded-2xl border px-3 py-2.5 text-xs leading-snug",
                step.status === "complete" && "border-emerald-200/80 bg-emerald-50/80 text-emerald-950",
                step.status === "active" && "border-primary/30 bg-primary/5 text-foreground",
                step.status === "action" && "border-primary/25 bg-primary/[0.07] text-foreground",
                step.status === "pending" && "border-border/50 bg-muted/30 text-muted-foreground",
              )}
            >
              <StepIcon status={step.status} />
              <span className="min-w-0 flex-1 font-medium">{step.label}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function StepIcon({ status }: { status: StepStatus }) {
  if (status === "complete") {
    return (
      <CheckCircle2
        className="mt-0.5 size-4 shrink-0 text-emerald-600"
        aria-hidden="true"
      />
    )
  }
  if (status === "active") {
    return (
      <Loader2
        className="mt-0.5 size-4 shrink-0 animate-spin text-primary"
        aria-hidden="true"
      />
    )
  }
  if (status === "action") {
    return (
      <Sparkles
        className="mt-0.5 size-4 shrink-0 text-primary"
        aria-hidden="true"
      />
    )
  }
  return (
    <Circle
      className="mt-0.5 size-4 shrink-0 text-muted-foreground/50"
      aria-hidden="true"
    />
  )
}
