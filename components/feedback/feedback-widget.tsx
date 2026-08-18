"use client"

import { useState } from "react"

import { FeedbackForm } from "@/components/feedback/feedback-form"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"

export function FeedbackWidget() {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [formKey, setFormKey] = useState(0)

  function handleOpenChange(next: boolean) {
    if (!next && busy) return
    setOpen(next)
    if (!next) {
      window.setTimeout(() => setFormKey((key) => key + 1), 200)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
      disablePointerDismissal={busy}
    >
      <DialogTrigger
        render={
          <Button className="rounded-full gradient-purple px-5 font-medium text-primary-foreground shadow-soft transition-transform hover:scale-[1.03] hover:opacity-95" />
        }
      >
        反馈
      </DialogTrigger>
      <DialogContent className="min-h-0 overflow-hidden">
        <FeedbackForm
          key={formKey}
          onBusyChange={setBusy}
          onClose={() => handleOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
