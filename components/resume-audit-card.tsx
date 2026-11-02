"use client"

import { AlertTriangle, CheckCircle2, Info, ShieldAlert } from "lucide-react"
import type { RewriteResult } from "@/lib/agent/types"
import { cn } from "@/lib/utils"

/**
 * 匹配分析与校验结果：只展示，不进入复制/导出正文。
 */
export function ResumeAuditCard({ rewrite }: { rewrite?: RewriteResult | null }) {
  const verification = rewrite?.verification
  const requirements = rewrite?.analysis?.requirements ?? []
  const pending = verification?.pending ?? []

  if (!verification && requirements.length === 0) return null

  const status = verification?.status ?? "draft"
  const issues = verification?.issues ?? []

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-4 shadow-soft">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">匹配分析与待核实</p>
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
            status === "ready"
              ? "bg-emerald-100 text-emerald-700"
              : "bg-amber-100 text-amber-800",
          )}
        >
          {status === "ready" ? "可直接投递" : "待完善草稿"}
        </span>
      </div>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
        这里只展示分析与缺口，不会进入简历正文、复制或导出内容。
      </p>

      {requirements.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {requirements.slice(0, 8).map((item, index) => (
            <li key={`${item.requirement}-${index}`} className="flex items-start gap-1.5 text-xs">
              <StatusDot status={item.status} />
              <span className="min-w-0 flex-1 leading-relaxed">
                <span className="text-foreground">{item.requirement}</span>
                <span className="text-muted-foreground">
                  {" · "}
                  {item.status === "direct"
                    ? "有直接证据"
                    : item.status === "transferable"
                      ? "可迁移经验"
                      : "暂无证据（未写入正文）"}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}

      {issues.length > 0 && (
        <ul className="mt-3 space-y-1.5 border-t border-border/50 pt-3">
          {issues.map((issue, index) => (
            <li key={`${issue.code}-${index}`} className="flex items-start gap-1.5 text-xs">
              {issue.severity === "error" ? (
                <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-destructive" aria-hidden="true" />
              ) : issue.autoFixed ? (
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
              ) : (
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600" aria-hidden="true" />
              )}
              <span
                className={cn(
                  "min-w-0 flex-1 leading-relaxed",
                  issue.severity === "error" ? "text-destructive" : "text-muted-foreground",
                )}
              >
                {issue.message}
                {issue.autoFixed && "（已自动修复）"}
              </span>
            </li>
          ))}
        </ul>
      )}

      {pending.length > 0 && (
        <div className="mt-3 border-t border-border/50 pt-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <Info className="size-3.5" aria-hidden="true" />
            待补充 / 待核实
          </p>
          <ul className="mt-1.5 space-y-1">
            {pending.slice(0, 8).map((item, index) => (
              <li key={`${item}-${index}`} className="text-xs leading-relaxed text-muted-foreground">
                · {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function StatusDot({ status }: { status: "direct" | "transferable" | "none" }) {
  const color =
    status === "direct" ? "bg-emerald-500" : status === "transferable" ? "bg-amber-500" : "bg-slate-400"
  return <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", color)} aria-hidden="true" />
}
