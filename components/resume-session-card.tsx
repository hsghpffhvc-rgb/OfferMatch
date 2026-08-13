"use client"

import { BarChart3, Play, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { IncompleteSessionKind } from "@/lib/workspace-session"
import type { AgentPhase } from "@/lib/agent/types"

interface ResumeSessionCardProps {
  kind: IncompleteSessionKind
  resumePhase: AgentPhase | null
  onContinue: () => void
  onDiscard: () => void
}

const kindCopy: Record<IncompleteSessionKind, { title: string; body: string }> = {
  analysis: {
    title: "你有未完成的简历优化",
    body: "检测到上次分析尚未完成，是否继续从中断处恢复？",
  },
  interview: {
    title: "你有未完成的面试测评",
    body: "检测到上次模拟面试进度尚未完成，是否继续作答？",
  },
  both: {
    title: "你有未完成的简历优化 / 面试测评",
    body: "检测到上次会话仍有未完成进度，是否继续？",
  },
}

export function ResumeSessionCard({
  kind,
  resumePhase,
  onContinue,
  onDiscard,
}: ResumeSessionCardProps) {
  const copy = kindCopy[kind]

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-border/60 bg-card p-6 shadow-2xl">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <BarChart3 className="size-6" aria-hidden="true" />
        </div>
        <h3 className="text-center text-lg font-semibold text-foreground">{copy.title}</h3>
        <p className="mt-2 text-center text-sm leading-relaxed text-muted-foreground">
          {copy.body}
          {resumePhase ? (
            <span className="mt-1 block text-xs text-primary">
              将定位到阶段 {resumePhase}
            </span>
          ) : null}
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button
            variant="outline"
            onClick={onDiscard}
            className="gap-2 rounded-full px-4"
          >
            <RotateCcw className="size-4" aria-hidden="true" />
            放弃重来
          </Button>
          <Button
            onClick={onContinue}
            className="gap-2 rounded-full gradient-purple text-primary-foreground shadow-soft"
          >
            <Play className="size-4" aria-hidden="true" />
            继续
          </Button>
        </div>
      </div>
    </div>
  )
}
