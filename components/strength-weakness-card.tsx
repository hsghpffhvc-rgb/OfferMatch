"use client"

import { Sparkles } from "lucide-react"
import type { MatchScores } from "@/lib/agent/types"
import { cn } from "@/lib/utils"

interface StrengthWeaknessCardProps {
  scores?: MatchScores | null
  isLoading?: boolean
}

function SectionList({
  title,
  items,
  tone,
}: {
  title: string
  items: string[]
  tone: "green" | "red"
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-background/70 p-4">
      {/* 小标题加大一号并加粗 */}
      <p
        className={cn(
          "text-sm font-bold",
          tone === "green" ? "text-emerald-600" : "text-red-600",
        )}
      >
        {title}
      </p>
      <div className="mt-3 space-y-2">
        {items.length ? (
          items.map((item) => (
            <div
              key={item}
              className={cn(
                "rounded-xl px-3 py-2 text-xs leading-relaxed",
                tone === "green"
                  ? "bg-emerald-500/10 text-emerald-700"
                  : "bg-red-500/10 text-red-700",
              )}
            >
              {item}
            </div>
          ))
        ) : (
          <p className="text-xs text-muted-foreground">暂无</p>
        )}
      </div>
    </div>
  )
}

export function StrengthWeaknessCard({ scores, isLoading }: StrengthWeaknessCardProps) {
  const data = scores ?? null
  const strengths = data?.strengths ?? []
  const weaknesses = data?.weaknesses ?? []
  const actionItems = data?.actionItems ?? []

  return (
    <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-accent text-primary">
            <Sparkles className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-medium">亮点 / 短板 / 建议</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {isLoading && !scores ? "AI 正在分析…" : "基于七维评分与关键词交叉结果生成"}
            </p>
          </div>
        </div>
        <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-foreground">
          {isLoading && !scores ? "分析中…" : "行动方案"}
        </span>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <SectionList title="亮点" items={strengths} tone="green" />
        <SectionList title="短板" items={weaknesses} tone="red" />
      </div>

      <div className="mt-3 rounded-2xl border border-border/60 bg-gradient-to-br from-[#A18AFF]/10 via-card to-[#C4B5FF]/10 p-4">
        <p className="text-sm font-bold text-[#7C6FF0]">建议</p>
        <div className="mt-3 space-y-2">
          {actionItems.length ? (
            actionItems.map((item, index) => (
              <div
                key={item}
                className="flex gap-2 rounded-xl bg-background/80 px-3 py-2 text-xs leading-relaxed text-foreground"
              >
                {/* 建议内容按 1. 2. 3. 分点展示 */}
                <span className="shrink-0 font-semibold text-[#7C6FF0]">{index + 1}.</span>
                <span>{item}</span>
              </div>
            ))
          ) : (
            <p className="text-xs text-muted-foreground">暂无</p>
          )}
        </div>
      </div>
    </div>
  )
}
