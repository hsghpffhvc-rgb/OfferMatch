import Link from "next/link"
import { duration, overviewMetrics } from "@/lib/admin-analytics"
import type { Report } from "@/lib/posthog-reports"
import type { AnalysisSessionRow } from "@/lib/supabase-admin"

export function AdminOverview({ report, days }: { report: Report; days: number }) {
  const rows = report.status === "ready" ? report.rows : null
  return <section className="mt-8 border-y border-border py-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">大盘数据</h2><nav aria-label="统计时间范围" className="flex gap-4">{[7,14,30].map(day => <Link key={day} href={`/admin?days=${day}`} aria-current={day === days ? "page" : undefined} className={`border-b-2 py-2 text-sm ${day === days ? "border-primary text-primary" : "border-transparent"}`}>近 {day} 天</Link>)}</nav></div>
    <p className="mt-2 text-xs text-muted-foreground">生产域名 · 各行为独立去重人数 · 上传仅指文件解析成功，不含粘贴文字</p>
    <div className="mt-5 grid grid-cols-2 gap-6 md:grid-cols-4">{overviewMetrics.map(([event, action, label]) => <div key={label}><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{rows ? Number(rows.find(row => row[0] === event && row[1] === action)?.[2] ?? 0).toLocaleString("zh-CN") : "--"}</p></div>)}</div>
    <div className="mt-6 flex flex-wrap gap-8 border-t border-border pt-4">{[["analysis_first_response", "平均首响应时间"], ["analysis_completed", "平均完整分析耗时"]].map(([event,label]) => { const row = rows?.find(row => row[0] === event); return <div key={event}><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 font-semibold">{row ? duration(row[3]) : "未知"}</p><p className="text-xs text-muted-foreground">有效样本：{rows ? Number(row?.[4] ?? 0) : "--"}</p></div> })}</div>
    <p role="status" className="mt-4 text-xs text-muted-foreground">{report.status === "error" ? report.message : `数据读取于 ${new Date(report.updatedAt).toLocaleString("zh-CN", {timeZone:"Asia/Shanghai"})}（北京时间）`}</p>
  </section>
}

export function AnalysisDetails({ records, report, page, days, hasNext }: { records: AnalysisSessionRow[]; report: Report; page: number; days: number; hasNext: boolean }) {
  return <section className="mt-8">
    <h2 className="text-lg font-semibold">分析详情</h2>
    <p className="mt-1 text-xs text-muted-foreground">全部已入库的模型成功分析 · 每页 25 条 · 不受大盘日期筛选影响</p>
    {report.status === "error" && <p role="status" className="mt-3 text-sm text-muted-foreground">{report.message}</p>}
    {!records.length && <p className="py-6 text-sm text-muted-foreground">本页暂无分析记录。</p>}
    <div className="mt-4 divide-y divide-border border-y border-border">{records.map(record => {
      const events = report.status === "ready" ? report.rows.filter(row => row[0] === record.session_id) : []
      const find = (event: string, action = "", phase = "") => events.find(row => row[1] === event && row[2] === action && row[3] === phase)
      const behavior = (event: string, action = "") => find(event, action) ? "已记录" : "未知 / 未观测到"
      return <details key={record.id} className="py-4">
        <summary className="cursor-pointer break-words text-sm"><span className="font-medium">{record.title || "未命名岗位"}</span><span className="ml-3 text-muted-foreground">{new Date(record.created_at).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })} · {record.score_before} → {record.score_after}</span></summary>
        <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <p className="break-all">匿名用户：{record.anonymous_id || "未知"}</p><p className="break-all">分析 ID：{record.session_id}</p><p>分析过程：已完成（模型结果）</p>
          <p>复制生成简历：{behavior("resume_copied")}</p><p>PDF 生成成功：{behavior("pdf_exported", "generated")}</p><p>PDF 下载点击：{behavior("pdf_exported", "downloaded")}</p><p>开始面试：{behavior("interview_started")}</p>
          <p>首响应：{duration(find("analysis_first_response")?.[5])}</p><p>完整分析：{duration(find("analysis_completed")?.[5])}</p>
          {["A","B","C"].map((phase,index) => <p key={phase}>{["岗位分析","简历大纲","简历重写"][index]}耗时：{duration(find("analysis_phase_completed", "", phase)?.[5])}</p>)}
          <p>PDF 生成平均耗时：{duration(find("pdf_exported", "generated")?.[5])}</p><p>面试生成平均耗时：{duration(find("interview_completed")?.[5])}</p>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">JD 摘要：{record.jd_preview || "未知"}</p>
      </details>
    })}</div>
    <nav aria-label="分析详情分页" className="mt-4 flex items-center justify-between text-sm">
      {page > 1 ? <Link href={`/admin?days=${days}&page=${page-1}`}>上一页</Link> : <span />}
      <span>第 {page} 页</span>{hasNext ? <Link href={`/admin?days=${days}&page=${page+1}`}>下一页</Link> : <span />}
    </nav>
  </section>
}
