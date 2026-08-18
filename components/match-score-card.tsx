"use client"

import { useState } from "react"
import { BarChart3, ChevronDown, ChevronRight, Sparkles } from "lucide-react"
import { DIMENSIONS, calculateOverall, type MatchScores } from "@/lib/agent/types"
import { cn } from "@/lib/utils"

interface MatchScoreCardProps {
  scores?: MatchScores | null
  isLoading?: boolean
}

function hasUsableScores(scores: MatchScores | null | undefined): boolean {
  if (!scores) return false
  const overall = scores.overallAfter ?? calculateOverall(scores, false)
  if (overall > 0) return true
  return DIMENSIONS.some((dimension) => {
    const score = scores[dimension.key]
    return score.before > 0 || score.after > 0
  })
}

export function MatchScoreCard({ scores, isLoading }: MatchScoreCardProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const ready = hasUsableScores(scores)

  if (isLoading && !ready) {
    return (
      <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-soft">
        <div className="h-6 w-32 animate-pulse rounded-full bg-muted" />
        <div className="mt-4 flex items-center gap-5">
          <div className="size-32 animate-pulse rounded-full bg-muted" />
          <div className="flex-1 space-y-3">
            {Array.from({ length: 7 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <div className="h-4 w-full animate-pulse rounded-full bg-muted" />
                <div className="h-2 w-full animate-pulse rounded-full bg-muted/80" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!ready) {
    return (
      <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-soft">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-accent text-primary">
            <BarChart3 className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-medium">整体匹配度</p>
            <p className="text-xs text-muted-foreground">before / after 七维评分总览</p>
          </div>
        </div>

        <div className="mt-6 flex flex-col items-center justify-center px-4 py-8 text-center">
          <div className="relative mb-4 flex size-28 items-center justify-center">
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#A18AFF]/20 to-[#9F7CFF]/10" />
            <div className="absolute inset-3 rounded-full border border-dashed border-primary/30" />
            <Sparkles className="relative size-8 text-primary/70" aria-hidden="true" />
          </div>
          <p className="text-sm font-medium text-foreground">完成职位描述解析后查看你的匹配度分析图</p>
          <p className="mt-1.5 max-w-[16rem] text-xs leading-relaxed text-muted-foreground">
            上传职位描述并完成分析后，这里会展示七维 before / after 评分
          </p>
        </div>
      </div>
    )
  }

  const data = scores!
  const overallBefore = data.overallBefore ?? calculateOverall(data, true)
  const overallAfter = data.overallAfter ?? calculateOverall(data, false)
  const delta = overallAfter - overallBefore
  const radius = 52
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (overallAfter / 100) * circumference
  const metrics = DIMENSIONS.map((dimension) => ({
    ...dimension,
    score: data[dimension.key],
  }))

  return (
    <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-accent text-primary">
            <BarChart3 className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-medium">整体匹配度</p>
            <p className="text-xs text-muted-foreground">before / after 七维评分总览</p>
          </div>
        </div>
        <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-foreground">
          {data.label}
        </span>
      </div>

      <div className="mt-4 flex items-center gap-5">
        <div className="relative size-32 shrink-0">
          <svg className="size-full -rotate-90" viewBox="0 0 120 120" aria-hidden="true">
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke="var(--color-secondary)"
              strokeWidth="10"
            />
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-2xl font-semibold tracking-tight">{overallAfter || "—"}</span>
            <span className="mt-1 text-[11px] leading-tight text-muted-foreground">
              {`${overallBefore || 0}→${overallAfter || 0} ${delta >= 0 ? `↑${delta}` : `↓${Math.abs(delta)}`}`}
            </span>
            <span className="text-[10px] text-muted-foreground">满分 100</span>
          </div>
        </div>

        <div className="flex-1 space-y-3">
          {metrics.map((dimension) => {
            const isExpanded = expandedKey === dimension.key
            const beforeWidth = dimension.score.before
            const afterWidth = dimension.score.after

            return (
              <div key={dimension.key}>
                <button
                  type="button"
                  onClick={() => setExpandedKey(isExpanded ? null : dimension.key)}
                  className="w-full rounded-2xl text-left transition-colors hover:bg-muted/40"
                >
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: dimension.color }}
                        aria-hidden="true"
                      />
                      {dimension.name}
                    </span>
                    <span className="inline-flex items-center gap-1 font-semibold">
                      <span className="text-muted-foreground">{beforeWidth}%</span>
                      <span className="text-muted-foreground">→</span>
                      <span style={{ color: dimension.color }}>{afterWidth}%</span>
                      {isExpanded ? (
                        <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden="true" />
                      ) : (
                        <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden="true" />
                      )}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary/80">
                    <div
                      className="h-full rounded-full bg-muted transition-all duration-500"
                      style={{ width: `${beforeWidth}%` }}
                    />
                    <div
                      className={cn("-mt-2 h-2 rounded-full transition-all duration-500")}
                      style={{
                        width: `${afterWidth}%`,
                        backgroundColor: dimension.color,
                        opacity: 0.82,
                      }}
                    />
                  </div>
                </button>

                {isExpanded && (
                  <div className="mt-2 rounded-2xl border border-border/60 bg-muted/20 p-3 text-xs text-muted-foreground">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="mb-1 font-medium text-foreground">差距</p>
                        {dimension.score.gaps.length ? (
                          <ul className="space-y-1">
                            {dimension.score.gaps.map((gap) => (
                              <li key={gap} className="leading-relaxed">
                                • {gap}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p>暂无明显差距</p>
                        )}
                      </div>
                      <div>
                        <p className="mb-1 font-medium text-foreground">改进</p>
                        {dimension.score.improvements.length ? (
                          <ul className="space-y-1">
                            {dimension.score.improvements.map((item) => (
                              <li key={item} className="leading-relaxed">
                                • {item}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p>暂无新增改进项</p>
                        )}
                      </div>
                    </div>
                    <p className="mt-3 leading-relaxed">{dimension.description}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">评分标签</span>
        <span className="rounded-full border border-border/60 bg-background px-3 py-1 text-sm font-semibold text-foreground">
          {data.label}
        </span>
      </div>
    </div>
  )
}
