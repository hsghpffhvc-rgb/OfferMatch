"use client"

import {
  createElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react"
import { Download, ImagePlus, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ResumeData } from "@/lib/pdf/types"
import {
  TEMPLATE_OPTIONS,
  hasTemplate,
  type TemplateId,
} from "@/lib/pdf/templates/options"
import { AnalyticsEvent, track } from "@/lib/analytics"

/** 浏览器本地生成 PDF，避免依赖易超时的服务端 /api/export-pdf */
async function renderPdfInBrowser(resume: ResumeData): Promise<Blob> {
  const [{ pdf }, { getTemplate }, { registerClientResumeFonts }] =
    await Promise.all([
      import("@react-pdf/renderer"),
      import("@/lib/pdf/templates"),
      import("@/lib/pdf/register-client-fonts"),
    ])

  await registerClientResumeFonts()
  const Template = getTemplate(resume.metadata.template)
  // Template 根节点已是 <Document>；react-pdf 类型对自定义 props 过严
  const instance = pdf(
    createElement(Template, { resume }) as Parameters<typeof pdf>[0]
  )
  const blob = await instance.toBlob()
  if (!blob.size) throw new Error("PDF 响应为空，请重试")
  return blob
}

/** 服务端兜底（本地域名不通或客户端库异常时） */
async function renderPdfViaApi(
  resume: ResumeData,
  signal: AbortSignal
): Promise<Blob> {
  const res = await fetch("/api/export-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(resume),
    signal,
  })

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      error?: string
    } | null
    throw new Error(body?.error || `导出失败（${res.status}）`)
  }

  const blob = await res.blob()
  if (!blob.size) throw new Error("PDF 响应为空，请重试")
  return blob
}

interface ResumePdfPreviewProps {
  resumeData: ResumeData
  defaultTemplate?: string
}

const MAX_PHOTO_BYTES = 2 * 1024 * 1024
const ACCEPTED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"]

function hashResumeData(data: ResumeData): string {
  const raw = JSON.stringify(data)
  let hash = 0
  for (let i = 0; i < raw.length; i++) {
    hash = (Math.imul(31, hash) + raw.charCodeAt(i)) | 0
  }
  return Math.abs(hash).toString(36)
}

function buildFileName(resumeData: ResumeData): string {
  const rawName = resumeData.basics?.name?.trim()
  const candidateName =
    rawName && !["求职者", "name"].includes(rawName.toLowerCase())
      ? rawName
      : "Name"
  const jobTitle = resumeData.basics?.title?.trim() || "岗位名称"
  return `${candidateName}-${jobTitle}.pdf`.replace(/[\\/:*?"<>|]/g, "-")
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result)
      else reject(new Error("照片读取失败"))
    }
    reader.onerror = () => reject(new Error("照片读取失败"))
    reader.readAsDataURL(file)
  })
}

export function ResumePdfPreview({
  resumeData,
  defaultTemplate = "minimal",
}: ResumePdfPreviewProps) {
  const initialTemplate = hasTemplate(defaultTemplate)
    ? defaultTemplate
    : "minimal"
  const [templateId, setTemplateId] = useState(initialTemplate)
  const [photo, setPhoto] = useState<string | undefined>(
    resumeData.basics.photo
  )
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)

  // 上游 resumeData 变化时同步证件照（用户本地上传优先保留）
  useEffect(() => {
    setPhoto((prev) => {
      if (prev?.startsWith("data:image/")) return prev
      return resumeData.basics.photo
    })
  }, [resumeData.basics.photo])

  const fileName = useMemo(() => buildFileName(resumeData), [resumeData])

  const payload = useMemo<ResumeData>(
    () => ({
      ...resumeData,
      basics: {
        ...resumeData.basics,
        photo: photo?.trim() || undefined,
      },
      metadata: {
        ...resumeData.metadata,
        template: templateId,
      },
    }),
    [resumeData, templateId, photo]
  )

  const resumeHash = useMemo(() => hashResumeData(payload), [payload])

  const generatePdf = useCallback(async () => {
    setLoading(true)
    setError(null)

    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), 90_000)

    try {
      let blob: Blob
      let via: "client" | "api" = "api"
      try {
        // 优先服务端生成，避免浏览器主线程被中文字体渲染卡死
        blob = await renderPdfViaApi(payload, controller.signal)
      } catch (apiErr) {
        console.warn("服务端 PDF 生成失败，尝试客户端:", apiErr)
        via = "client"
        blob = await renderPdfInBrowser(payload)
      }

      const url = URL.createObjectURL(blob)
      setPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return url
      })
      track(AnalyticsEvent.pdfExported, {
        template: templateId,
        bytes: blob.size,
        action: "generated",
        via,
      })
    } catch (err) {
      setPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
      let message = "PDF 生成失败"
      if (err instanceof DOMException && err.name === "AbortError") {
        message =
          "PDF 生成超时。请确认已用自定义域名访问，并在 Cloudflare 开启橙色云代理后重试"
      } else if (err instanceof TypeError) {
        message =
          "网络连接失败，无法生成 PDF。请用已绑定的自定义域名访问（并建议 Cloudflare 代理），不要直连 vercel.app"
      } else if (err instanceof Error && err.message) {
        message = err.message
      }
      setError(message)
    } finally {
      window.clearTimeout(timeoutId)
      setLoading(false)
    }
  }, [payload, templateId])

  useEffect(() => {
    void generatePdf()
    return () => {
      setPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
    }
  }, [generatePdf, templateId, resumeHash])

  const handleDownload = () => {
    if (!pdfUrl) return
    const anchor = window.document.createElement("a")
    anchor.href = pdfUrl
    anchor.download = fileName
    anchor.click()
    track(AnalyticsEvent.pdfExported, {
      template: templateId,
      action: "downloaded",
    })
  }

  const handlePhotoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return

    if (!ACCEPTED_PHOTO_TYPES.includes(file.type)) {
      setPhotoError("仅支持 JPG / PNG / WebP")
      return
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setPhotoError("照片需小于 2MB")
      return
    }

    try {
      const dataUrl = await readFileAsDataUrl(file)
      setPhoto(dataUrl)
      setPhotoError(null)
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "照片读取失败")
    }
  }

  const clearPhoto = () => {
    setPhoto(undefined)
    setPhotoError(null)
  }

  // 桌面预览；移动端 iframe PDF 支持差，优先引导下载
  const previewSrc = pdfUrl
    ? `${pdfUrl}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`
    : null
  const lightboxSrc = pdfUrl
    ? `${pdfUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`
    : null

  // Esc 关闭大图预览
  useEffect(() => {
    if (!lightboxOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightboxOpen(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [lightboxOpen])

  return (
    <div className="w-full text-left">
      <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-[#A18AFF]/10 via-card to-[#C4B5FF]/10 p-3 sm:p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium">PDF 模板预览</p>
          <div className="flex flex-wrap gap-2">
            {TEMPLATE_OPTIONS.map((opt) => {
              const selected = templateId === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setTemplateId(opt.id as TemplateId)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-medium transition-all sm:px-3.5 sm:text-sm",
                    selected
                      ? "border-2 border-[#A18AFF] bg-[#A18AFF]/15 text-[#9F7CFF] shadow-[0_4px_24px_rgba(161,138,255,0.12)]"
                      : "border border-border/70 bg-background/80 text-muted-foreground hover:border-[#A18AFF]/50 hover:text-foreground"
                  )}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            ref={photoInputRef}
            type="file"
            accept={ACCEPTED_PHOTO_TYPES.join(",")}
            className="sr-only"
            onChange={(e) => void handlePhotoChange(e)}
          />
          {photo ? (
            <div className="flex items-center gap-2">
              <img
                src={photo}
                alt="证件照预览"
                className="h-[52px] w-10 object-cover"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5 rounded-full"
                onClick={() => photoInputRef.current?.click()}
              >
                <ImagePlus className="size-3.5" aria-hidden="true" />
                更换照片
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-1 rounded-full text-muted-foreground"
                onClick={clearPhoto}
              >
                <X className="size-3.5" aria-hidden="true" />
                移除
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5 rounded-full border-[#A18AFF]/40 hover:bg-[#A18AFF]/10"
              onClick={() => photoInputRef.current?.click()}
            >
              <ImagePlus className="size-3.5" aria-hidden="true" />
              上传证件照
            </Button>
          )}
          {photoError ? (
            <p className="text-xs text-destructive">{photoError}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              可选 · JPG/PNG/WebP · 不传则模板自动隐藏
            </p>
          )}
        </div>

        <div
          key={`${templateId}-${resumeHash}`}
          className="overflow-hidden rounded-2xl border border-border/50 bg-[#2b2b2b]"
        >
          {loading ? (
            <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground sm:h-[640px]">
              正在生成 PDF 预览…
            </div>
          ) : error ? (
            <div className="flex h-[320px] flex-col items-center justify-center gap-3 px-4 text-center sm:h-[640px]">
              <p className="text-sm text-destructive">{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => void generatePdf()}
              >
                重试
              </Button>
            </div>
          ) : previewSrc ? (
            <>
              {/* 手机：iframe 常不可用，引导下载 */}
              <div className="flex flex-col items-center gap-3 px-4 py-8 text-center sm:hidden">
                <p className="text-sm text-white/90">
                  手机端建议直接下载 PDF 查看（浏览器内预览支持有限）
                </p>
                <Button
                  size="sm"
                  className="gap-1.5 rounded-full gradient-purple text-primary-foreground"
                  onClick={handleDownload}
                >
                  <Download className="size-3.5" aria-hidden="true" />
                  下载 PDF
                </Button>
                <a
                  href={pdfUrl ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-white/60 underline underline-offset-2"
                >
                  尝试在新标签页打开
                </a>
              </div>

              {/* 桌面：单栏预览，避免双 iframe 卡顿 */}
              <div className="relative hidden h-[640px] overflow-hidden bg-[#525659] sm:block">
                <iframe
                  title="简历 PDF 主预览"
                  src={previewSrc}
                  className="h-full w-full border-0 bg-white"
                />
                <div
                  className="group absolute inset-0 z-10 cursor-zoom-in"
                  onClick={() => setLightboxOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      setLightboxOpen(true)
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label="点击放大预览简历"
                >
                  <span className="pointer-events-none absolute right-4 top-4 flex size-10 items-center justify-center rounded-full bg-black/55 text-white opacity-0 shadow-lg backdrop-blur transition-opacity group-hover:opacity-100">
                    <Search className="size-5" aria-hidden="true" />
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground sm:h-[640px]">
              暂无预览
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            disabled={loading || !pdfUrl}
            className="gap-1.5 rounded-full border-[#A18AFF]/40 hover:bg-[#A18AFF]/10"
            onClick={handleDownload}
          >
            <Download className="size-3.5" aria-hidden="true" />
            {loading ? "生成中…" : "下载 PDF"}
          </Button>
        </div>
      </div>

      {lightboxOpen && lightboxSrc && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm sm:p-8"
          role="dialog"
          aria-modal="true"
          aria-label="简历大图预览"
          onClick={() => setLightboxOpen(false)}
        >
          <div
            className="relative flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-[#2b2b2b] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              aria-label="关闭大图预览"
              onClick={() => setLightboxOpen(false)}
              className="absolute right-3 top-3 z-20 flex size-9 items-center justify-center rounded-full bg-black/65 text-white transition-colors hover:bg-black/80"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
            <iframe
              title="简历 PDF 大图"
              src={lightboxSrc}
              className="h-full w-full flex-1 border-0 bg-white"
            />
          </div>
        </div>
      )}
    </div>
  )
}
