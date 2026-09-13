import { Lock, LogOut, MessageSquare, Sparkles, Users } from "lucide-react"
import type { ReactNode } from "react"

import { isAdminAuthenticated } from "@/lib/admin-auth"
import {
  isSupabaseConfigured,
  listRecentAnalysisSessions,
  listRecentFeedback,
  type AnalysisSessionRow,
  type FeedbackRow,
} from "@/lib/supabase-admin"
import { FEEDBACK_TYPE_META, STEP_LABELS, type BugStep } from "@/types/feedback"

export const dynamic = "force-dynamic"

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function isToday(value: string): boolean {
  const date = new Date(value)
  const now = new Date()
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  )
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: number | string
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-5 py-4 shadow-soft">
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-md bg-secondary text-primary">
          {icon}
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-0.5 text-2xl font-semibold">{value}</p>
        </div>
      </div>
    </div>
  )
}

function LoginView({ hasError }: { hasError: boolean }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-mesh px-4">
      <section className="w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-soft">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-secondary text-primary">
            <Lock className="size-5" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">OfferMatch 后台</h1>
            <p className="text-sm text-muted-foreground">输入管理员密码查看用户数据</p>
          </div>
        </div>
        <form className="mt-6 space-y-4" action="/api/admin/login" method="post">
          <input
            className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/30"
            name="password"
            type="password"
            placeholder="ADMIN_PASSWORD"
            autoComplete="current-password"
          />
          {hasError && <p className="text-sm text-destructive">密码不正确或尚未配置。</p>}
          <button
            className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            type="submit"
          >
            进入后台
          </button>
        </form>
      </section>
    </main>
  )
}

function AnalysisTable({ rows }: { rows: AnalysisSessionRow[] }) {
  if (!rows.length) {
    return (
      <p className="rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">
        暂无分析记录。
      </p>
    )
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card shadow-soft">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-border bg-secondary/70 text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">时间</th>
              <th className="px-4 py-3 font-medium">岗位</th>
              <th className="px-4 py-3 font-medium">行业</th>
              <th className="px-4 py-3 font-medium">分数</th>
              <th className="px-4 py-3 font-medium">简历</th>
              <th className="px-4 py-3 font-medium">JD 摘要</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr className="border-b border-border/70 last:border-0" key={row.id}>
                <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                  {formatDate(row.created_at)}
                </td>
                <td className="max-w-[180px] px-4 py-3 font-medium">
                  <span className="line-clamp-2">{row.title || "未命名岗位"}</span>
                </td>
                <td className="whitespace-nowrap px-4 py-3">{row.industry || "-"}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  {row.score_before} →{" "}
                  <span className="font-semibold text-primary">{row.score_after}</span>
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  {row.has_resume ? "已上传" : "未上传"}
                </td>
                <td className="max-w-[280px] px-4 py-3 text-muted-foreground">
                  <span className="line-clamp-2">{row.jd_preview || "-"}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function FeedbackList({ rows }: { rows: FeedbackRow[] }) {
  if (!rows.length) {
    return (
      <p className="rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">
        暂无反馈。
      </p>
    )
  }

  return (
    <div className="grid gap-3">
      {rows.map((row) => {
        const meta = FEEDBACK_TYPE_META[row.type]
        const steps = row.steps
          ?.map((step) => STEP_LABELS[step as BugStep] ?? step)
          .filter(Boolean)

        return (
          <article className="rounded-lg border border-border bg-card p-4 shadow-soft" key={row.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="rounded-md bg-secondary px-2 py-1 text-xs text-secondary-foreground">
                  {meta?.label ?? row.type}
                </span>
                {row.rating ? <span className="text-muted-foreground">评分 {row.rating}</span> : null}
                {row.contact ? <span className="font-medium text-primary">{row.contact}</span> : null}
              </div>
              <time className="text-xs text-muted-foreground">{formatDate(row.created_at)}</time>
            </div>
            {steps && steps.length > 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">步骤：{steps.join("、")}</p>
            ) : null}
            {row.reproducible !== null && row.reproducible !== undefined ? (
              <p className="mt-2 text-sm text-muted-foreground">
                可复现：{row.reproducible ? "是" : "否"}
              </p>
            ) : null}
            {row.error_text ? (
              <p className="mt-3 whitespace-pre-wrap rounded-md bg-secondary/70 p-3 text-sm leading-6">
                {row.error_text}
              </p>
            ) : null}
            {row.message ? <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{row.message}</p> : null}
            {row.page ? <p className="mt-2 text-xs text-muted-foreground">页面：{row.page}</p> : null}
          </article>
        )
      })}
    </div>
  )
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string }>
}) {
  const params = searchParams ? await searchParams : {}
  const authed = await isAdminAuthenticated()
  if (!authed) return <LoginView hasError={params.error === "1"} />

  const [analysisRows, feedbackRows] = await Promise.all([
    listRecentAnalysisSessions(100),
    listRecentFeedback(100),
  ])
  const todayAnalysis = analysisRows.filter((row) => isToday(row.created_at)).length
  const contactFeedback = feedbackRows.filter((row) => row.contact).length
  const uniqueVisitors = new Set(analysisRows.map((row) => row.anonymous_id).filter(Boolean)).size

  return (
    <main className="min-h-screen bg-mesh px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold sm:text-3xl">OfferMatch 用户数据</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              用来跟进前 100 个用户：看分析记录、反馈和可回访线索。
            </p>
          </div>
          <form action="/api/admin/logout" method="post">
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm transition-colors hover:bg-secondary"
              type="submit"
            >
              <LogOut className="size-4" />
              退出
            </button>
          </form>
        </header>

        {!isSupabaseConfigured() && (
          <div className="mt-6 rounded-lg border border-destructive/30 bg-card p-4 text-sm text-destructive">
            Supabase 尚未配置。请先在 Supabase SQL Editor 执行 supabase/schema.sql，并设置
            NEXT_PUBLIC_SUPABASE_URL、SUPABASE_SERVICE_ROLE_KEY、ADMIN_PASSWORD。
          </div>
        )}

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={<Sparkles className="size-4" />} label="最近分析" value={analysisRows.length} />
          <StatCard icon={<Sparkles className="size-4" />} label="今日分析" value={todayAnalysis} />
          <StatCard icon={<Users className="size-4" />} label="独立访客" value={uniqueVisitors} />
          <StatCard icon={<MessageSquare className="size-4" />} label="可回访反馈" value={contactFeedback} />
        </section>

        <section className="mt-8">
          <h2 className="text-lg font-semibold">最近分析</h2>
          <p className="mb-3 mt-1 text-sm text-muted-foreground">
            先看分数、岗位和是否上传简历，判断真实使用质量。
          </p>
          <AnalysisTable rows={analysisRows} />
        </section>

        <section className="mt-8 pb-12">
          <h2 className="text-lg font-semibold">最近反馈</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            有联系方式的优先回访，最适合转成早期访谈。
          </p>
          <div className="mt-3">
            <FeedbackList rows={feedbackRows} />
          </div>
        </section>
      </div>
    </main>
  )
}
