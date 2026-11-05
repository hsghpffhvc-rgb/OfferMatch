"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Loader2, Target } from "lucide-react"
import { EvidenceDetail } from "@/components/evidence-detail"
import {
  getPersistedEvidenceState,
  suppressResumePromptOnce,
  type PersistedEvidenceState,
} from "@/lib/workspace-session"

/**
 * 证据补足深链页：只读展示已提交的问答，逻辑与主界面弹窗共用 EvidenceDetail。
 * 保留整页形态用于分享链接 / 新标签页查看。
 */
export default function EvidenceDetailPage() {
  const [evidence, setEvidence] = useState<PersistedEvidenceState | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setEvidence(getPersistedEvidenceState())
    setReady(true)
  }, [])

  return (
    <div className="min-h-screen bg-mesh">
      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/"
            onClick={suppressResumePromptOnce}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-medium text-muted-foreground transition hover:bg-muted/60 hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            返回主界面
          </Link>
        </div>

        <header className="mt-4 flex items-start gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Target className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-lg font-semibold text-foreground">阶段C · 简历匹配证据补足详情</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              这里记录了你补充的经历与数据。未提供或标记为「无相关经历/数据」的缺口，重写简历时会用 XXX 占位，不会编造。
            </p>
          </div>
        </header>

        <div className="mt-6">
          {!ready ? (
            <div className="flex items-center gap-2.5 rounded-2xl bg-muted/30 p-4">
              <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" />
              <p className="text-sm text-muted-foreground">正在读取证据记录…</p>
            </div>
          ) : (
            <EvidenceDetail
              gaps={evidence?.gaps ?? []}
              answers={evidence?.answers ?? {}}
              skippedGapIds={evidence?.skippedGapIds ?? []}
            />
          )}
        </div>
      </main>
    </div>
  )
}
