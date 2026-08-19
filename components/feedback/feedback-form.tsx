"use client"

import { useState } from "react"
import { Check, Loader2, Mail, Send } from "lucide-react"
import { usePathname } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"
import { StarRating } from "@/components/feedback/star-rating"
import { validateFeedbackForm } from "@/lib/feedback/validate"
import { AnalyticsEvent, hashString, identify, track } from "@/lib/analytics"
import { cn } from "@/lib/utils"
import {
  BUG_STEPS,
  FEEDBACK_TYPE_META,
  FEEDBACK_TYPES,
  OTHER_EXAMPLES,
  STEP_LABELS,
  STUCK_STEPS,
  type BugStep,
  type FeedbackFieldErrors,
  type FeedbackType,
  type StuckStep,
} from "@/types/feedback"

const CONTACT_EMAIL = "1448052594@qq.com"

interface FeedbackFormProps {
  onBusyChange?: (busy: boolean) => void
  onClose?: () => void
}

function toggleStep<T extends string>(list: T[], step: T, checked: boolean): T[] {
  if (checked) {
    return list.includes(step) ? list : [...list, step]
  }
  return list.filter((item) => item !== step)
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1.5 text-sm text-destructive">{message}</p>
}

export function FeedbackForm({ onBusyChange, onClose }: FeedbackFormProps) {
  const pathname = usePathname()
  const [type, setType] = useState<FeedbackType | null>(null)
  const [bugSteps, setBugSteps] = useState<BugStep[]>([])
  const [stuckSteps, setStuckSteps] = useState<StuckStep[]>([])
  const [reproducible, setReproducible] = useState<boolean | null>(null)
  const [errorText, setErrorText] = useState("")
  const [message, setMessage] = useState("")
  const [contact, setContact] = useState("")
  const [rating, setRating] = useState<number | null>(null)
  const [errors, setErrors] = useState<FeedbackFieldErrors>({})
  const [submitError, setSubmitError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  async function submit() {
    setSubmitError("")
    const result = validateFeedbackForm({
      type,
      bugSteps,
      stuckSteps,
      reproducible,
      errorText,
      message,
      contact,
      rating,
    })
    if (!result.ok) {
      setErrors(result.errors)
      return
    }

    setErrors({})
    setSubmitting(true)
    onBusyChange?.(true)
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...result.data,
          page: pathname,
        }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setSubmitError(data.error || "提交失败，请稍后再试")
        return
      }
      setDone(true)
      track(AnalyticsEvent.feedbackSubmitted, {
        type: result.data.type,
        hasContact: Boolean(result.data.contact),
        stepCount: result.data.steps?.length ?? 0,
        rating: result.data.rating ?? 0,
      })
      if (result.data.contact) {
        // 用哈希关联访客，不把邮箱/微信原文上报 PostHog
        identify(hashString(result.data.contact))
      }
    } catch {
      setSubmitError("网络异常，提交失败")
    } finally {
      setSubmitting(false)
      onBusyChange?.(false)
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
        <div className="flex size-12 items-center justify-center rounded-full gradient-purple text-primary-foreground shadow-soft">
          <Check className="size-6" />
        </div>
        <DialogTitle>已收到！</DialogTitle>
        <DialogDescription className="max-w-xs">
          {contact.trim()
            ? "我们会优先处理影响求职进度的问题。处理进展会第一时间同步给你。"
            : "我们会优先处理影响求职进度的问题。谢谢你帮我们改进。"}
        </DialogDescription>
        <Button
          className="mt-2 rounded-full gradient-purple px-5 text-primary-foreground"
          onClick={onClose}
        >
          好的
        </Button>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-5 pb-2 sm:px-6">
        <div className="pr-8">
          <DialogTitle>告诉我们哪里出了问题</DialogTitle>
          <DialogDescription className="mt-1">
            你的反馈会直接决定我们下一步优化什么
          </DialogDescription>
        </div>

        <fieldset className="mt-5">
          <legend className="text-sm font-medium">反馈类型</legend>
          <RadioGroup
            className="mt-2 grid grid-cols-2 gap-2"
            value={type ?? ""}
            onValueChange={(value) => {
              setType(value as FeedbackType)
              setErrors((prev) => ({ ...prev, type: undefined }))
            }}
          >
            {FEEDBACK_TYPES.map((id) => {
              const meta = FEEDBACK_TYPE_META[id]
              const selected = type === id
              return (
                <label
                  key={id}
                  className={cn(
                    "relative cursor-pointer rounded-xl border bg-[#A18AFF]/8 px-3 pt-8 pb-3 text-sm font-medium transition-colors focus-within:ring-2 focus-within:ring-[#A18AFF]/30",
                    selected
                      ? "border-[#9F7CFF] bg-[#A18AFF]/16 ring-2 ring-[#A18AFF]/25"
                      : "border-border/70 hover:border-[#A18AFF]/50",
                  )}
                >
                  <span
                    className="absolute top-2 left-2.5 text-base leading-none"
                    aria-hidden="true"
                  >
                    {meta.emoji}
                  </span>
                  <RadioGroupItem value={id} className="sr-only" />
                  {meta.label}
                </label>
              )
            })}
          </RadioGroup>
          <FieldError message={errors.type} />
        </fieldset>

        {type === "bug" && (
          <div className="mt-5 space-y-5">
            <div>
              <label htmlFor="fb-error-text" className="text-sm font-medium">
                页面报错提示
              </label>
              <Textarea
                id="fb-error-text"
                value={errorText}
                onChange={(e) => {
                  setErrorText(e.target.value)
                  setErrors((prev) => ({ ...prev, errorText: undefined }))
                }}
                maxLength={2000}
                rows={3}
                placeholder="请粘贴或描述页面上看到的报错提示"
                aria-invalid={Boolean(errors.errorText)}
                className="mt-2 resize-none"
              />
              <FieldError message={errors.errorText} />
            </div>

            <fieldset>
              <legend className="text-sm font-medium">发生在哪一步</legend>
              <div className="mt-2 grid gap-2">
                {BUG_STEPS.map((step) => (
                  <label
                    key={step}
                    className="flex cursor-pointer items-center gap-2.5 text-sm"
                  >
                    <Checkbox
                      checked={bugSteps.includes(step)}
                      onCheckedChange={(checked) => {
                        setBugSteps((prev) => toggleStep(prev, step, checked))
                        setErrors((prev) => ({ ...prev, steps: undefined }))
                      }}
                    />
                    {STEP_LABELS[step]}
                  </label>
                ))}
              </div>
              <FieldError message={errors.steps} />
            </fieldset>

            <fieldset>
              <legend className="text-sm font-medium">能否复现</legend>
              <RadioGroup
                className="mt-2 grid grid-cols-2 gap-2"
                value={
                  reproducible === null ? "" : reproducible ? "yes" : "no"
                }
                onValueChange={(value) => {
                  setReproducible(value === "yes")
                  setErrors((prev) => ({ ...prev, reproducible: undefined }))
                }}
              >
                {[
                  { value: "yes", label: "是" },
                  { value: "no", label: "否" },
                ].map((option) => (
                  <label
                    key={option.value}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/70 px-3 py-2 text-sm has-[[data-checked]]:border-[#9F7CFF] has-[[data-checked]]:bg-[#A18AFF]/10"
                  >
                    <RadioGroupItem value={option.value} />
                    {option.label}
                  </label>
                ))}
              </RadioGroup>
              <FieldError message={errors.reproducible} />
            </fieldset>
          </div>
        )}

        {type === "stuck" && (
          <fieldset className="mt-5">
            <legend className="text-sm font-medium">卡顿发生在哪一步</legend>
            <div className="mt-2 grid gap-2">
              {STUCK_STEPS.map((step) => (
                <label
                  key={step}
                  className="flex cursor-pointer items-center gap-2.5 text-sm"
                >
                  <Checkbox
                    checked={stuckSteps.includes(step)}
                    onCheckedChange={(checked) => {
                      setStuckSteps((prev) => toggleStep(prev, step, checked))
                      setErrors((prev) => ({ ...prev, steps: undefined }))
                    }}
                  />
                  {STEP_LABELS[step]}
                </label>
              ))}
            </div>
            <FieldError message={errors.steps} />
          </fieldset>
        )}

        {type === "feature" && (
          <div className="mt-5">
            <label htmlFor="fb-feature" className="text-sm font-medium">
              你想要什么新功能
            </label>
            <Textarea
              id="fb-feature"
              value={message}
              onChange={(e) => {
                setMessage(e.target.value)
                setErrors((prev) => ({ ...prev, message: undefined }))
              }}
              maxLength={2000}
              rows={4}
              placeholder="例如：希望支持同时对比多个岗位…"
              aria-invalid={Boolean(errors.message)}
              className="mt-2 resize-none"
            />
            <FieldError message={errors.message} />
          </div>
        )}

        {type === "other" && (
          <div className="mt-5">
            <label htmlFor="fb-other" className="text-sm font-medium">
              请简单说明一下
            </label>
            <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              例如：
            </p>
            <ul className="mt-1.5 space-y-1.5">
              {OTHER_EXAMPLES.map((example) => (
                <li key={example}>
                  <button
                    type="button"
                    onClick={() => {
                      setMessage(example)
                      setErrors((prev) => ({ ...prev, message: undefined }))
                    }}
                    className="w-full rounded-lg border border-border/70 bg-[#A18AFF]/6 px-3 py-2 text-left text-xs leading-relaxed text-muted-foreground transition-colors hover:border-[#A18AFF]/50 hover:bg-[#A18AFF]/10 hover:text-foreground"
                  >
                    {example}
                  </button>
                </li>
              ))}
            </ul>
            <Textarea
              id="fb-other"
              value={message}
              onChange={(e) => {
                setMessage(e.target.value)
                setErrors((prev) => ({ ...prev, message: undefined }))
              }}
              maxLength={2000}
              rows={4}
              placeholder="也可以直接选择上面的例子，或自己补充说明…"
              aria-invalid={Boolean(errors.message)}
              className="mt-3 resize-none"
            />
            <FieldError message={errors.message} />
          </div>
        )}

        <div className="mt-5">
          <p className="text-sm font-medium">整体评分</p>
          <p className="mt-1 text-xs text-muted-foreground">
            最高 5 星，可半星点选（选填）
          </p>
          <div className="mt-2">
            <StarRating value={rating} onChange={setRating} id="fb-rating" />
          </div>
        </div>

        <div className="mt-5">
          <label htmlFor="fb-contact" className="text-sm font-medium">
            留下您的邮箱或微信{" "}
            <span className="font-normal text-muted-foreground">（选填）</span>
          </label>
          <Input
            id="fb-contact"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            maxLength={120}
            placeholder="邮箱 / 微信"
            className="mt-2"
          />
        </div>

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

        {submitError && (
          <p className="mt-3 text-sm text-destructive">{submitError}</p>
        )}
      </div>

      <div className="shrink-0 border-t border-border/60 px-5 py-4 sm:px-6">
        <Button
          onClick={submit}
          disabled={submitting}
          className="w-full rounded-full gradient-purple py-2.5 font-medium text-primary-foreground shadow-soft transition-transform hover:scale-[1.01] disabled:opacity-70"
        >
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              发送中…
            </>
          ) : (
            <>
              <Send className="size-4" />
              发送反馈
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
