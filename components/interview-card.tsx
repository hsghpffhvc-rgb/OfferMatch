"use client"

import { useRef, useState } from "react"
import { Check, ChevronDown, Loader2, Target } from "lucide-react"
import type { InterviewQuestion } from "@/lib/agent/types"
import { cn } from "@/lib/utils"
import { AnalyticsEvent, track } from "@/lib/analytics"
import { Button } from "@/components/ui/button"

const categoryLabels: Record<string, { label: string; color: string }> = {
  resume_deep_dive: { label: "简历深挖", color: "bg-purple-100 text-purple-700" },
  technical: { label: "技术专业", color: "bg-blue-100 text-blue-700" },
  behavioral: { label: "行为面试", color: "bg-orange-100 text-orange-700" },
  job_fit: { label: "岗位匹配", color: "bg-cyan-100 text-cyan-700" },
  motivation: { label: "动机文化", color: "bg-green-100 text-green-700" },
}

const difficultyLabels: Record<string, string> = {
  easy: "基础",
  medium: "中等",
  hard: "困难",
}

interface InterviewCardProps {
  question: InterviewQuestion
  index: number
  initialAnswer?: string
  submitted?: boolean
  onSubmitAnswer?: (questionId: string, answer: string, index: number) => void
}

export function InterviewCard({
  question,
  index,
  initialAnswer = "",
  submitted = false,
  onSubmitAnswer,
}: InterviewCardProps) {
  const [expanded, setExpanded] = useState(submitted || Boolean(initialAnswer))
  const [copied, setCopied] = useState(false)
  const [answer, setAnswer] = useState(initialAnswer)
  const [isSubmitted, setIsSubmitted] = useState(submitted)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const submittingLock = useRef(false)
  const cat = categoryLabels[question.category] ?? categoryLabels.resume_deep_dive

  // 一键复制示范话术，方便候选人直接练习
  const copyAnswer = async (event: React.MouseEvent) => {
    event.stopPropagation()
    try {
      await navigator.clipboard.writeText(question.referenceAnswer)
      setCopied(true)
      track(AnalyticsEvent.interviewAnswerCopied, {
        question_id: question.id,
        category: question.category,
      })
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  const handleSubmit = () => {
    if (!answer.trim() || isSubmitted || submittingLock.current) return
    submittingLock.current = true
    setIsSubmitting(true)
    try {
      onSubmitAnswer?.(question.id, answer.trim(), index)
      setIsSubmitted(true)
    } finally {
      setIsSubmitting(false)
      // 保持锁定到已提交态，避免重复提交
    }
  }

  return (
    <div
      id={`interview-q-${index}`}
      className="rounded-2xl border border-border/60 bg-card p-4 shadow-soft transition-colors hover:border-primary/30"
    >
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-start gap-3 text-left"
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span className={cn("rounded-md px-2 py-0.5 text-xs font-medium", cat.color)}>
              {cat.label}
            </span>
            <span className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
              {difficultyLabels[question.difficulty] ?? question.difficulty}
            </span>
            {isSubmitted && (
              <span className="inline-flex items-center gap-1 rounded-md bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                <Check className="size-3" aria-hidden="true" />
                已作答
              </span>
            )}
          </div>
          <p className="text-sm font-medium leading-relaxed text-foreground">{question.question}</p>
        </div>
        <ChevronDown
          className={cn(
            "mt-1 size-4 shrink-0 text-muted-foreground transition-transform",
            expanded && "rotate-180",
          )}
          aria-hidden="true"
        />
      </button>

      {expanded && (
        <div className="mt-4 border-t border-border/40 pt-4 pl-0 sm:pl-10">
          {/* 考察意图：轻量一行，不抢示范回答的视觉重心 */}
          <div className="mb-3 flex gap-2">
            <Target className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <p className="text-xs text-muted-foreground">
              考察意图：<span className="text-foreground">{question.intent}</span>
            </p>
          </div>

          {/* 练习作答区 */}
          <div className="mb-3 rounded-xl border border-border/60 bg-muted/20 p-3">
            <p className="mb-2 text-xs font-medium text-foreground">我的练习回答</p>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={4}
              disabled={isSubmitted || isSubmitting}
              placeholder="按 STAR 写下你的回答，提交后会自动保存进度…"
              className="w-full resize-none rounded-lg border border-border/50 bg-background px-3 py-2 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
            />
            <div className="mt-2 flex justify-end">
              <Button
                type="button"
                size="sm"
                onClick={handleSubmit}
                disabled={!answer.trim() || isSubmitted || isSubmitting}
                className={cn(
                  "gap-1.5 rounded-full",
                  (isSubmitted || isSubmitting) && "pointer-events-none opacity-50",
                )}
              >
                {isSubmitting ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                ) : isSubmitted ? (
                  <Check className="size-3.5" aria-hidden="true" />
                ) : null}
                {isSubmitted ? "已提交" : isSubmitting ? "提交中…" : "提交答案"}
              </Button>
            </div>
          </div>

          {/* 浅色底 + color-scheme:light，避免系统深色模式下 text-foreground 变成浅色字而看不见 */}
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 [color-scheme:light]">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-green-900">
                参考回答示范
              </span>
              <button
                type="button"
                onClick={copyAnswer}
                className="shrink-0 text-xs font-medium text-green-800 hover:underline"
              >
                {copied ? "已复制" : "复制话术"}
              </button>
            </div>
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-green-950">
              {question.referenceAnswer}
            </p>
          </div>

          {/* 辅助区：思路 + 桥接 */}
          <p className="mt-3 text-xs text-muted-foreground">
            💡 思路：{question.answerStrategy}
          </p>
          {question.personalizedBridge && (
            <div className="mt-2 rounded-lg bg-primary/5 px-3 py-2 text-xs text-primary">
              🔗 {question.personalizedBridge}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
