"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, ClipboardList, RotateCcw, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ResumePreview } from "@/components/resume-preview"
import { PersonaCard } from "@/components/persona-card"
import { MatchScoreCard } from "@/components/match-score-card"
import { InterviewCard } from "@/components/interview-card"
import {
  deleteHistoryRecord,
  formatHistoryTime,
  getHistoryRecord,
  restoreHistoryToWorkspace,
  type HistoryRecord,
} from "@/lib/history-storage"

interface HistoryDetailProps {
  id: string
}

export function HistoryDetail({ id }: HistoryDetailProps) {
  const router = useRouter()
  const [record, setRecord] = useState<HistoryRecord | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setRecord(getHistoryRecord(id))
    setReady(true)
  }, [id])

  if (!ready) {
    return <p className="text-sm text-muted-foreground">加载中…</p>
  }

  if (!record) {
    return (
      <div className="rounded-3xl border border-dashed border-border/70 px-6 py-12 text-center">
        <p className="text-sm font-medium">找不到这条历史记录</p>
        <Link
          href="/history"
          className="mt-4 inline-flex h-8 items-center justify-center rounded-full border border-border bg-background px-3 text-sm font-medium hover:bg-muted"
        >
          返回列表
        </Link>
      </div>
    )
  }

  const handleRestore = () => {
    restoreHistoryToWorkspace(record)
    router.push("/")
  }

  const handleDelete = () => {
    if (!window.confirm("确定删除这条历史记录？")) return
    deleteHistoryRecord(record.id)
    router.push("/history")
  }

  const interview = record.interview

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-4">
          <Link
            href="/history"
            className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:border-[#A18AFF]/50 hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            列表
          </Link>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
              {record.title}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatHistoryTime(record.createdAt)}
              {record.industry ? ` · ${record.industry}` : ""}
              {record.label ? ` · ${record.label}` : ""}
              {interview ? " · 含面试准备" : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button className="gap-1.5 rounded-full" onClick={handleRestore}>
            <RotateCcw className="size-3.5" aria-hidden="true" />
            恢复到工作台
          </Button>
          <Button
            variant="outline"
            className="gap-1.5 rounded-full text-destructive hover:bg-destructive/10"
            onClick={handleDelete}
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
            删除
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
        <div className="min-w-0 space-y-6">
          <ResumePreview
            markdown={record.rewrite.rewrittenResumeMarkdown ?? ""}
            rewriteResult={record.rewrite}
          />

          {/* 面试题与示范回答（历史详情） */}
          {interview ? (
            <section className="space-y-4">
              <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-soft">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <ClipboardList className="size-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-medium">面试准备清单</p>
                    <p className="text-xs text-muted-foreground">来自该次模拟面试结果</p>
                  </div>
                </div>
                {interview.preparationChecklist.length > 0 && (
                  <ul className="mt-4 space-y-1.5">
                    {interview.preparationChecklist.map((item, i) => (
                      <li key={`${item}-${i}`} className="flex gap-2 text-sm text-foreground">
                        <span className="text-primary">○</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <p className="mb-3 text-sm font-medium">
                  高频面试题与示范回答（{interview.questions.length} 题）
                </p>
                <div className="space-y-3">
                  {interview.questions.map((q, i) => (
                    <InterviewCard key={q.id ?? i} question={q} index={i} />
                  ))}
                </div>
              </div>
            </section>
          ) : (
            <div className="rounded-3xl border border-dashed border-border/60 bg-card/50 px-5 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                该记录尚未生成模拟面试。可「恢复到工作台」后继续出题。
              </p>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <PersonaCard persona={record.persona} />
          <MatchScoreCard scores={record.rewrite.scores} />
        </aside>
      </div>
    </div>
  )
}
