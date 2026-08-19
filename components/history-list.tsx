"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Clock3,
  FileText,
  RotateCcw,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  clearHistoryRecords,
  deleteHistoryRecord,
  formatHistoryTime,
  listHistoryRecords,
  restoreHistoryToWorkspace,
  type HistoryRecord,
} from "@/lib/history-storage"
import { AnalyticsEvent, track } from "@/lib/analytics"

export function HistoryList() {
  const router = useRouter()
  const [records, setRecords] = useState<HistoryRecord[]>([])

  const refresh = useCallback(() => {
    setRecords(listHistoryRecords())
  }, [])

  useEffect(() => {
    refresh()
    track(AnalyticsEvent.historyViewed, {
      page: "history_list",
      record_count: listHistoryRecords().length,
    })
    // 仅进入页面时记一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh])

  const handleDelete = (id: string) => {
    if (!window.confirm("确定删除这条历史记录？")) return
    deleteHistoryRecord(id)
    refresh()
  }

  const handleClear = () => {
    if (!window.confirm("确定清空全部历史记录？此操作不可恢复。")) return
    clearHistoryRecords()
    refresh()
  }

  const handleRestore = (record: HistoryRecord) => {
    restoreHistoryToWorkspace(record)
    track(AnalyticsEvent.historyRestored, {
      from: "history_list",
      has_interview: Boolean(record.interview),
      overall_score: record.overallAfter,
    })
    router.push("/")
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-4">
          <Link
            href="/"
            className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:border-[#A18AFF]/50 hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            返回
          </Link>
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              历史记录
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              保存在本机浏览器（localStorage），最多 20 条；换设备不会同步
            </p>
          </div>
        </div>
        {records.length > 0 && (
          <Button variant="outline" size="sm" className="rounded-full" onClick={handleClear}>
            清空全部
          </Button>
        )}
      </div>

      {records.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border/70 bg-card/50 px-6 py-16 text-center">
          <FileText className="mx-auto mb-3 size-10 text-muted-foreground/60" aria-hidden="true" />
          <p className="text-sm font-medium text-foreground">还没有历史简历</p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            完成一次「分析并生成简历」后，记录会出现在这里
          </p>
          <Link
            href="/"
            className="mt-5 inline-flex h-8 items-center justify-center rounded-full gradient-purple px-4 text-sm font-medium text-primary-foreground shadow-soft"
          >
            去生成一份
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {records.map((record) => (
            <li
              key={record.id}
              className="rounded-3xl border border-border/60 bg-card p-4 shadow-soft transition-colors hover:border-primary/30 sm:p-5"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-base font-semibold text-foreground">
                      {record.title}
                    </h2>
                    {record.label && (
                      <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                        {record.label}
                      </span>
                    )}
                    <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                      匹配度{record.overallAfter}
                    </span>
                  </div>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="size-3.5" aria-hidden="true" />
                      {formatHistoryTime(record.createdAt)}
                    </span>
                    {record.industry && <span>{record.industry}</span>}
                    <span>{record.hasResume ? "含原始简历" : "仅职位描述生成"}</span>
                    {record.interview && <span>含面试准备</span>}
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  <Link
                    href={`/history/${record.id}`}
                    className="inline-flex h-7 items-center justify-center rounded-full border border-border bg-background px-2.5 text-[0.8rem] font-medium hover:bg-muted"
                  >
                    查看
                  </Link>
                  <Button
                    size="sm"
                    className="gap-1.5 rounded-full"
                    onClick={() => handleRestore(record)}
                  >
                    <RotateCcw className="size-3.5" aria-hidden="true" />
                    恢复到工作台
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => handleDelete(record.id)}
                    aria-label="删除记录"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
