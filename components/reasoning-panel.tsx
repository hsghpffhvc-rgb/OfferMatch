"use client"

import type { AgentPhase } from "@/lib/agent/types"
import { Loader2 } from "lucide-react"

const phaseLabels: Record<AgentPhase, string> = {
  A: "阶段 A · JD 深度解析",
  B: "阶段 B · 逆向推导大纲",
  C: "阶段 C · 差异化重写",
  D: "阶段 D · 模拟面试",
}

/** 无模型原文时，向用户展示的阶段进度说明（避免暴露内部 JSON） */
const phaseStatusCopy: Record<AgentPhase, string> = {
  A: "正在解析岗位要求，提炼理想候选人画像与关键技能…",
  B: "正在根据 JD 与画像，构建理想简历大纲…",
  C: "正在评估匹配度并重写简历，请稍候…",
  D: "正在生成面试预测题与作答策略…",
}

interface ReasoningPanelProps {
  text: string
  currentPhase: AgentPhase | null
  phaseMessage?: string | null
  isStreaming: boolean
}

export function ReasoningPanel({
  text,
  currentPhase,
  phaseMessage,
  isStreaming,
}: ReasoningPanelProps) {
  if (!text && !isStreaming) return null

  // 优先展示服务端阶段文案；其次用本地进度文案；仅在有过滤后的自然语言时才展示原文
  const statusText =
    text.trim() ||
    phaseMessage?.trim() ||
    (currentPhase ? phaseStatusCopy[currentPhase] : "正在连接 AI 引擎…")

  return (
    <div className="mt-6 w-full max-w-2xl text-left">
      <div className="rounded-3xl border border-border/70 bg-card/80 p-4 shadow-soft backdrop-blur">
        <div className="mb-3 flex items-center gap-2">
          {isStreaming && <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" />}
          <p className="text-sm font-medium">
            {currentPhase ? phaseLabels[currentPhase] : "AI 分析进度"}
          </p>
        </div>
        <div className="max-h-64 overflow-y-auto rounded-2xl bg-secondary/30 p-4">
          <pre className="whitespace-pre-wrap break-words font-sans text-xs leading-relaxed text-foreground">
            {statusText}
          </pre>
        </div>
      </div>
    </div>
  )
}
