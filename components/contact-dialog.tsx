"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { Send, Check, X, Loader2, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { track } from "@/lib/analytics"

const CONTACT_EMAIL = "1448052594@qq.com"

const fieldClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:border-ring focus:outline-none focus:ring-3 focus:ring-ring/30"

export function ContactDialog() {
  const pathname = usePathname()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState("")
  const [name, setName] = useState("")
  const [contact, setContact] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting) setOpen(false)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, submitting])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        panelRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return
      }
      if (!submitting) close()
    }
    document.addEventListener("mousedown", onPointerDown)
    return () => document.removeEventListener("mousedown", onPointerDown)
  }, [open, submitting])

  function reset() {
    setMessage("")
    setName("")
    setContact("")
    setError("")
    setDone(false)
  }

  function close() {
    if (submitting) return
    setOpen(false)
    setTimeout(reset, 200)
  }

  async function submit() {
    setError("")
    if (message.trim().length < 2) {
      setError("说两句嘛～你的体验对我很重要")
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: "suggestion",
          message: message.trim(),
          name: name.trim() || undefined,
          contact: contact.trim() || undefined,
          wantReply: false,
          page: pathname,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setError(data.error || "提交失败，请稍后再试")
        return
      }
      setDone(true)
      track("feedback_submitted", {
        category: "suggestion",
        rating: null,
        wantsReply: Boolean(contact.trim()),
        hasContact: Boolean(contact.trim()),
      })
    } catch {
      setError("网络异常，提交失败")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative">
      <Button
        ref={triggerRef}
        className="rounded-full gradient-purple px-5 font-medium text-primary-foreground shadow-soft transition-transform hover:scale-[1.03] hover:opacity-95"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        联系与反馈
      </Button>

      {open && (
        <div
          ref={panelRef}
          className="fixed inset-x-3 bottom-3 z-50 w-auto overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-soft sm:absolute sm:inset-auto sm:bottom-auto sm:right-0 sm:top-[calc(100%+0.75rem)] sm:w-[min(24rem,calc(100vw-1.5rem))]"
          role="dialog"
          aria-modal="true"
          aria-label="联系与反馈"
        >
          <button
            type="button"
            onClick={close}
            className="absolute right-3 top-3 z-10 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="关闭"
          >
            <X className="size-4" />
          </button>

          {done ? (
            <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
              <div className="flex size-12 items-center justify-center rounded-full gradient-purple text-primary-foreground shadow-soft">
                <Check className="size-6" />
              </div>
              <h3 className="text-lg font-semibold">收到啦，谢谢你！</h3>
              <p className="max-w-xs text-sm text-muted-foreground">
                {contact.trim()
                  ? "你的反馈已经记下了，我会尽快通过你留的方式联系你～"
                  : "你的反馈已经记下了，我会认真看每一条。"}
              </p>
              <Button
                className="mt-2 rounded-full gradient-purple px-5 text-primary-foreground"
                onClick={close}
              >
                好的
              </Button>
            </div>
          ) : (
            <div className="px-5 py-5 sm:px-6">
              <h3 className="pr-8 text-lg font-semibold">联系与反馈</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                说说产品使用体验，或想完善、增加的功能。
              </p>

              {/* 第一项：体验 / 建议 */}
              <div className="mt-4">
                <label htmlFor="cf-message" className="text-sm font-medium">
                  你的体验 / 建议 <span className="text-destructive">*</span>
                </label>
                <textarea
                  id="cf-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  maxLength={2000}
                  placeholder="比如：哪一步最卡、想要什么功能、哪里不爽…"
                  className={`mt-2 resize-none ${fieldClass}`}
                />
              </div>

              {/* 第二项：称呼 & 联系方式（选填） */}
              <div className="mt-4">
                <label className="text-sm font-medium">
                  您的称呼 & 联系方式{" "}
                  <span className="font-normal text-muted-foreground">（选填）</span>
                </label>
                <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <input
                    id="cf-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={50}
                    placeholder="怎么称呼你"
                    aria-label="称呼"
                    className={fieldClass}
                  />
                  <input
                    id="cf-contact"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    maxLength={120}
                    placeholder="邮箱 / 微信"
                    aria-label="联系方式"
                    className={fieldClass}
                  />
                </div>
              </div>

              {/* 第三项：联系我们 */}
              <div className="mt-4 rounded-xl bg-secondary/60 px-3.5 py-3">
                <p className="text-sm font-medium">联系我们</p>
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="mt-1.5 inline-flex items-center gap-1.5 text-sm text-primary transition-opacity hover:opacity-80"
                >
                  <Mail className="size-3.5 shrink-0" aria-hidden="true" />
                  <span>📮 {CONTACT_EMAIL}</span>
                </a>
              </div>

              {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

              <Button
                onClick={submit}
                disabled={submitting}
                className="mt-4 w-full rounded-full gradient-purple py-2.5 font-medium text-primary-foreground shadow-soft transition-transform hover:scale-[1.01] disabled:opacity-70"
              >
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    提交中…
                  </>
                ) : (
                  <>
                    <Send className="size-4" />
                    提交
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
