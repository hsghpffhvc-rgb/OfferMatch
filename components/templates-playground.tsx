"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ZoomIn } from "lucide-react"
import {
  TEMPLATE_OPTIONS,
  getTemplateOption,
  hasTemplate,
  type TemplateId,
} from "@/lib/pdf/templates/options"
import { cn } from "@/lib/utils"
import { AnalyticsEvent, track } from "@/lib/analytics"

export function TemplatesPlayground() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const fromQuery = searchParams.get("template") ?? "minimal"
  const initial = (hasTemplate(fromQuery) ? fromQuery : "minimal") as TemplateId
  const [templateId, setTemplateId] = useState<TemplateId>(initial)
  const [zoomedTemplateId, setZoomedTemplateId] = useState<TemplateId | null>(null)

  useEffect(() => {
    track(AnalyticsEvent.templatesViewed, { template: initial })
    // 仅进入页面时记一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const next = (hasTemplate(fromQuery) ? fromQuery : "minimal") as TemplateId
    setTemplateId(next)
  }, [fromQuery])

  const selected = getTemplateOption(templateId)
  const zoomedTemplate = useMemo(
    () => (zoomedTemplateId ? getTemplateOption(zoomedTemplateId) : null),
    [zoomedTemplateId]
  )

  const selectTemplate = useCallback(
    (id: TemplateId) => {
      setTemplateId(id)
      track(AnalyticsEvent.templatesViewed, {
        template: id,
        action: "select",
      })
      const params = new URLSearchParams(searchParams.toString())
      params.set("template", id)
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [pathname, router, searchParams]
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {TEMPLATE_OPTIONS.map((opt) => {
            const active = templateId === opt.id
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => selectTemplate(opt.id)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-sm font-medium transition-all",
                  active
                    ? "border-2 border-[#A18AFF] bg-[#A18AFF]/15 text-[#9F7CFF]"
                    : "border border-border/70 bg-background text-muted-foreground hover:border-[#A18AFF]/50 hover:text-foreground"
                )}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
        <p className="text-sm text-muted-foreground">
          点击右上角放大镜查看大图，点任意位置返回预览模式
        </p>
      </div>

      <p className="text-sm text-muted-foreground">{selected.description}</p>

      <div className="grid gap-3 sm:grid-cols-3">
        {TEMPLATE_OPTIONS.map((opt) => {
          const active = templateId === opt.id
          return (
            <div
              key={opt.id}
              role="button"
              tabIndex={0}
              onClick={() => selectTemplate(opt.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault()
                  selectTemplate(opt.id)
                }
              }}
              className={cn(
                "group relative overflow-hidden rounded-xl border text-left outline-none transition-all",
                active
                  ? "border-[#A18AFF] ring-2 ring-[#A18AFF]/30"
                  : "border-border/60 hover:border-[#A18AFF]/50"
              )}
            >
              <button
                type="button"
                aria-label={`放大查看${opt.label}`}
                onClick={(event) => {
                  event.stopPropagation()
                  setTemplateId(opt.id)
                  setZoomedTemplateId(opt.id)
                }}
                className="absolute right-2 top-2 z-10 flex size-9 items-center justify-center rounded-full border border-white/70 bg-white/90 text-foreground shadow-lg transition-transform hover:scale-105 hover:bg-white"
              >
                <ZoomIn className="size-4" aria-hidden="true" />
              </button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={opt.previewSrc}
                alt={`${opt.label}简历模板预览`}
                className="aspect-[210/297] w-full bg-white object-cover object-top"
                loading="lazy"
              />
              <div className="border-t border-border/50 bg-card px-3 py-2">
                <p className="text-sm font-medium">{opt.label}</p>
                <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                  {opt.description}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="rounded-2xl border border-border/50 bg-gradient-to-br from-[#A18AFF]/10 via-card to-[#C4B5FF]/10 p-4 sm:p-5">
        <p className="text-center text-xs text-muted-foreground">
          静态效果预览 · 分析完成后可导出对应样式的 PDF
        </p>
      </div>

      {zoomedTemplate && (
        <div
          role="presentation"
          className="fixed inset-0 z-50 bg-black/70 px-4 py-6 backdrop-blur-md sm:px-8 sm:py-10"
          onClick={() => setZoomedTemplateId(null)}
        >
          <div className="flex h-full items-center justify-center">
            <div className="w-full max-w-5xl overflow-hidden rounded-3xl border border-white/15 bg-white shadow-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={zoomedTemplate.previewSrc}
                alt={`${zoomedTemplate.label}简历模板大图`}
                className="max-h-[calc(100vh-3rem)] w-full object-contain object-top sm:max-h-[calc(100vh-5rem)]"
                loading="eager"
                decoding="async"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
