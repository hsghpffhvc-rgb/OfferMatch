"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import { ArrowUp, FileText, Plus, Briefcase, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ReasoningPanel } from "@/components/reasoning-panel"
import { ResumePreview } from "@/components/resume-preview"
import type { AgentStreamState } from "@/lib/hooks/use-agent-stream"
import { extractFileText, FILE_ACCEPT, truncateFilename } from "@/lib/extract-file-text"
import { getPersistedInputs, patchWorkspace } from "@/lib/workspace-session"
import { AnalyticsEvent, track } from "@/lib/analytics"

interface HeroInputProps {
  state: AgentStreamState
  onAnalyze: (jd: string, resume: string) => void
}

type UploadTarget = "resume" | "jd"

export function HeroInput({ state, onAnalyze }: HeroInputProps) {
  // 首屏用空状态，避免 SSR / 客户端因 localStorage 文案不一致触发 hydration mismatch
  const [jd, setJd] = useState("")
  const [resume, setResume] = useState("")
  const [resumeFileName, setResumeFileName] = useState<string | null>(null)
  const [jdFileName, setJdFileName] = useState<string | null>(null)
  const [resumePhoto, setResumePhoto] = useState<string | null>(null)
  const [inputsHydrated, setInputsHydrated] = useState(false)
  const [uploading, setUploading] = useState<UploadTarget | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadNotice, setUploadNotice] = useState<string | null>(null)

  const resumeInputRef = useRef<HTMLInputElement>(null)
  const jdInputRef = useRef<HTMLInputElement>(null)
  const submitLock = useRef(false)

  const isStreaming = state.status === "streaming"
  const isUploading = uploading !== null

  // 挂载后再从 localStorage 恢复，保证服务端与首屏客户端 HTML 一致
  useEffect(() => {
    const saved = getPersistedInputs()
    setJd(saved.jd)
    setResume(saved.resume)
    setResumeFileName(saved.resumeFileName)
    setJdFileName(saved.jdFileName)
    setResumePhoto(saved.resumePhoto)
    setInputsHydrated(true)
  }, [])

  // 输入变化时同步到工作区（等恢复完成后再写，避免空值覆盖）
  useEffect(() => {
    if (!inputsHydrated) return
    patchWorkspace({
      inputs: { jd, resume, resumeFileName, jdFileName, resumePhoto },
    })
  }, [inputsHydrated, jd, resume, resumeFileName, jdFileName, resumePhoto])

  // 分析结束后释放提交锁
  useEffect(() => {
    if (state.status !== "streaming") {
      submitLock.current = false
    }
  }, [state.status])

  const handleAnalyze = () => {
    if (!jd.trim() || isStreaming || isUploading || submitLock.current) return
    submitLock.current = true
    onAnalyze(jd.trim(), resume.trim())
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleAnalyze()
    }
  }

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    target: UploadTarget,
  ) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return

    setUploadError(null)
    setUploadNotice(null)
    setUploading(target)

    try {
      const { text, filename, method, pageCount, photo } = await extractFileText(file)

      if (target === "resume") {
        setResume(text)
        setResumeFileName(filename)
        setResumePhoto(photo ?? null)
        track(AnalyticsEvent.resumeUploaded, {
          method: method ?? "text",
          has_photo: Boolean(photo),
          chars: text.length,
        })
      } else {
        setJd(text)
        setJdFileName(filename)
        track(AnalyticsEvent.jdUploaded, {
          method: method ?? "text",
          chars: text.length,
        })
      }

      if (method === "ocr") {
        setUploadNotice(
          `已通过 OCR 识别扫描版 PDF（${pageCount ?? "?"} 页），识别结果已填入${target === "jd" ? " JD 输入框" : "简历"}`,
        )
      }
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "文件上传失败")
    } finally {
      setUploading(null)
    }
  }

  const resumeLabel = uploading === "resume"
    ? "解析中…"
    : resumeFileName
      ? truncateFilename(resumeFileName)
      : resume
        ? "简历已就绪"
        : "上传简历"

  const jdLabel = uploading === "jd"
    ? "解析中…"
    : jdFileName
      ? truncateFilename(jdFileName)
      : "上传 JD 文件"

  return (
    <section className="flex w-full flex-col items-center text-center">
      <div className="w-full max-w-2xl">
        <div className="rounded-3xl border border-border/70 bg-card p-2.5 shadow-soft">
          <textarea
            value={jd}
            onChange={(e) => {
              setJd(e.target.value)
              if (jdFileName) setJdFileName(null)
            }}
            onKeyDown={handleKeyDown}
            rows={4}
            placeholder="粘贴目标岗位 JD，或点击「上传 JD 文件」导入 PDF / Word / TXT…"
            disabled={isStreaming || isUploading}
            className="w-full resize-none rounded-2xl bg-transparent px-4 py-3 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-60"
          />
          <div className="flex items-center justify-between gap-2 px-1.5 pb-1">
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={resumeInputRef}
                type="file"
                accept={FILE_ACCEPT}
                className="hidden"
                onChange={(e) => handleFileUpload(e, "resume")}
              />
              <input
                ref={jdInputRef}
                type="file"
                accept={FILE_ACCEPT}
                className="hidden"
                onChange={(e) => handleFileUpload(e, "jd")}
              />
              <UploadButton
                icon={FileText}
                label={resumeLabel}
                onClick={() => resumeInputRef.current?.click()}
                disabled={isStreaming || isUploading}
                spinning={uploading === "resume"}
                active={!!resume}
              />
              <UploadButton
                icon={Briefcase}
                label={jdLabel}
                onClick={() => jdInputRef.current?.click()}
                disabled={isStreaming || isUploading}
                spinning={uploading === "jd"}
                active={!!jdFileName}
              />
            </div>
            <Button
              size="icon"
              aria-label="开始分析"
              onClick={handleAnalyze}
              disabled={!jd.trim() || isStreaming || isUploading}
              className="size-10 shrink-0 rounded-full gradient-purple text-primary-foreground shadow-soft transition-transform hover:scale-105 disabled:pointer-events-none disabled:opacity-50"
            >
              {isStreaming ? (
                <Loader2 className="size-5 animate-spin" aria-hidden="true" />
              ) : (
                <ArrowUp className="size-5" aria-hidden="true" />
              )}
            </Button>
          </div>
        </div>

        {(uploadError || state.error) && (
          <p className="mt-3 text-xs text-destructive" role="alert">
            {uploadError ?? state.error}
          </p>
        )}
        {uploadNotice && !uploadError && (
          <p className="mt-3 text-xs text-primary" role="status">
            {uploadNotice}
          </p>
        )}
        {!uploadError && !state.error && !uploadNotice && (
          <p className="mt-3 text-xs text-muted-foreground">
            支持 PDF、Word（.doc / .docx）、TXT；扫描版 PDF 将自动 OCR 识别（最多 15 页，约需 30–90 秒）
            {resume && resumeFileName && ` · 简历：${resumeFileName}`}
          </p>
        )}
      </div>

      <ReasoningPanel
        text={state.reasoningText}
        currentPhase={state.currentPhase}
        phaseMessage={state.phaseMessage}
        isStreaming={isStreaming}
      />

      <ResumePreview
        markdown={state.rewrite?.rewrittenResumeMarkdown ?? ""}
        rewriteResult={state.rewrite}
        isLoading={isStreaming && state.currentPhase === "C"}
        resumePhoto={resumePhoto}
      />
    </section>
  )
}

function UploadButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  spinning,
  active,
}: {
  icon: React.ElementType
  label: string
  onClick: () => void
  disabled?: boolean
  spinning?: boolean
  active?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
        active
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border bg-secondary/60 text-secondary-foreground hover:border-primary/40 hover:bg-accent"
      }`}
    >
      <span className="flex size-5 items-center justify-center rounded-full bg-background text-primary shadow-sm">
        {spinning ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <Plus className="size-3.5" aria-hidden="true" />
        )}
      </span>
      {!spinning && (
        <Icon className="size-4 text-muted-foreground group-hover:text-foreground" aria-hidden="true" />
      )}
      <span className="max-w-[8rem] truncate">{label}</span>
    </button>
  )
}
