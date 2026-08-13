import { TrendingDown, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"

interface StatCardProps {
  label: string
  value: string
  delta: string
  trend: "up" | "down"
}

export function StatCard({ label, value, delta, trend }: StatCardProps) {
  const isUp = trend === "up"
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-soft">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-2">
        <span className="text-2xl font-semibold tracking-tight">{value}</span>
        <span
          className={cn(
            "flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
            isUp ? "bg-success/12 text-success" : "bg-danger/12 text-danger",
          )}
        >
          {isUp ? (
            <TrendingUp className="size-3.5" aria-hidden="true" />
          ) : (
            <TrendingDown className="size-3.5" aria-hidden="true" />
          )}
          {delta}
        </span>
      </div>
    </div>
  )
}
