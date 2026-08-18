"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import { FileText, Plus, Briefcase, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ReasoningPanel } from "@/components/reasoning-panel"
import { ResumePreview, useResumePreviewParts } from "@/components/resume-preview"
import type { AgentStreamState } from "@/lib/hooks/use-agent-stream"
import { extractFileText, FILE_ACCEPT, truncateFilename } from "@/lib/extract-file-text"
import { getPersistedInputs, patchWorkspace } from "@/lib/workspace-session"
import { AnalyticsEvent, track } from "@/lib/analytics"
import { cn } from "@/lib/utils"

interface HeroInputProps {
  state: AgentStreamState
  onAnalyze: (jd: string, resume: string) => void
  /** 递增后清空输入框与已上传文件（开始新分析 / 清空工作台） */
  resetKey?: number
  children?: (parts: {
    composer: React.ReactNode
    reasoning: React.ReactNode
    resumeMarkdown: React.ReactNode
    resumePdf: React.ReactNode
  }) => React.ReactNode
}

type UploadTarget = "resume" | "jd"

const JD_PLACEHOLDER =
  "把招聘软件（如 BOSS直聘/智联/猎聘）里的职位描述粘贴到这里，建议包含岗位职责 + 任职要求，AI 会更好地结合你的简历分析匹配度（或者点击「上传职位描述文件」导入PDF/Word/TXT）"

export function HeroInput({
  state,
  onAnalyze,
  resetKey = 0,
  children,
}: HeroInputProps) {
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

  useEffect(() => {
    if (resetKey > 0) {
      setJd("")
      setResume("")
      setResumeFileName(null)
      setJdFileName(null)
      setResumePhoto(null)
      setUploadError(null)
      setUploadNotice(null)
      setInputsHydrated(true)
      return
    }

    const saved = getPersistedInputs()
    setJd(saved.jd)
    setResume(saved.resume)
    setResumeFileName(saved.resumeFileName)
    setJdFileName(saved.jdFileName)
    setResumePhoto(saved.resumePhoto)
    setInputsHydrated(true)
  }, [resetKey])

  useEffect(() => {
    if (!inputsHydrated) return
    patchWorkspace({
      inputs: { jd, resume, resumeFileName, jdFileName, resumePhoto },
    })
  }, [inputsHydrated, jd, resume, resumeFileName, jdFileName, resumePhoto])

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
          `已通过 OCR 识别扫描版 PDF（${pageCount ?? "?"} 页），识别结果已填入${target === "jd" ? "职位描述输入框" : "简历"}`,
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
      : "上传职位描述文件"

  const composer = (
    <div className="flex h-full min-h-[280px] w-full flex-col">
      <div className="flex h-full min-h-0 flex-1 flex-col rounded-3xl border border-border/70 bg-card p-2.5 shadow-soft">
        <textarea
          value={jd}
          onChange={(e) => {
            setJd(e.target.value)
            if (jdFileName) setJdFileName(null)
          }}
          onKeyDown={handleKeyDown}
          placeholder={JD_PLACEHOLDER}
          disabled={isStreaming || isUploading}
          className="min-h-0 w-full flex-1 resize-none rounded-2xl bg-transparent px-4 py-3 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none disabled:opacity-60"
        />
        <div className="flex flex-wrap items-center justify-between gap-2 px-1.5 pb-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
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
            aria-label="开始匹配"
            onClick={handleAnalyze}
            disabled={!jd.trim() || isStreaming || isUploading}
            className="h-10 shrink-0 rounded-full px-6 text-sm font-bold text-white shadow-soft gradient-purple hover:scale-[1.02] disabled:pointer-events-none disabled:opacity-50"
          >
            {isStreaming ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              "开始匹配"
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
  )

  const resumeParts = useResumePreviewParts({
    markdown: state.rewrite?.rewrittenResumeMarkdown ?? "",
    rewriteResult: state.rewrite,
    isLoading: isStreaming && state.currentPhase === "C",
    resumePhoto,
  })

  const reasoning = (
    <ReasoningPanel
      text={state.reasoningText}
      currentPhase={state.currentPhase}
      phaseMessage={state.phaseMessage}
      isStreaming={isStreaming}
    />
  )

  if (children) {
    return (
      <>
        {children({
          composer,
          reasoning,
          resumeMarkdown: resumeParts.markdown,
          resumePdf: resumeParts.pdf,
        })}
      </>
    )
  }

  return (
    <section className="flex w-full flex-col items-center text-center">
      <div className="w-full max-w-2xl">{composer}</div>
      {reasoning}
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
      className={cn(
        "group flex items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors disabled:opacity-50",
        active
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border bg-secondary/60 text-secondary-foreground hover:border-primary/40 hover:bg-accent",
      )}
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
      <span className="max-w-[11rem] truncate">{label}</span>
    </button>
  )
}
