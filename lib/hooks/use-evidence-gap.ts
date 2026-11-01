"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type {
  EvidenceGap,
  PersonaResult,
  ResultSource,
  StreamEvent,
} from "@/lib/agent/types"
import {
  getPersistedEvidenceState,
  saveEvidenceState,
  type PersistedEvidenceState,
  type PersistedEvidenceStatus,
} from "@/lib/workspace-session"
import { getFallbackEvidenceGaps } from "@/lib/agent/fallback-content"
import { AnalyticsEvent, track } from "@/lib/analytics"

export type EvidenceGapStatus = PersistedEvidenceStatus

export interface EvidenceGapStreamState {
  analysisId?: string
  status: EvidenceGapStatus
  gaps: EvidenceGap[]
  coachingNote: string
  answers: Record<string, string>
  skippedGapIds: string[]
  error: string | null
  usedFallback: boolean
  streamInterrupted: boolean
}

export const initialEvidenceGapState: EvidenceGapStreamState = {
  status: "idle",
  gaps: [],
  coachingNote: "",
  answers: {},
  skippedGapIds: [],
  error: null,
  usedFallback: false,
  streamInterrupted: false,
}

function toPersisted(state: EvidenceGapStreamState): PersistedEvidenceState {
  return {
    analysisId: state.analysisId,
    status: state.status,
    gaps: state.gaps,
    coachingNote: state.coachingNote,
    answers: state.answers,
    skippedGapIds: state.skippedGapIds,
    result: null,
    error: state.error,
    usedFallback: state.usedFallback,
  }
}

function fromPersisted(saved: PersistedEvidenceState | null): EvidenceGapStreamState | null {
  if (!saved) return null
  const restoredStatus: PersistedEvidenceStatus =
    saved.status === "loading"
      ? "idle"
      : saved.status === "refining"
        ? saved.gaps.length > 0
          ? "questions"
          : "idle"
        : saved.status
  return {
    analysisId: saved.analysisId,
    status: restoredStatus,
    gaps: saved.gaps ?? [],
    coachingNote: saved.coachingNote ?? "",
    answers: saved.answers ?? {},
    skippedGapIds: saved.skippedGapIds ?? [],
    error: saved.error ?? null,
    usedFallback: Boolean(saved.usedFallback),
    streamInterrupted: false,
  }
}

async function readSse(response: Response, onEvent: (event: StreamEvent) => void): Promise<void> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error("无法读取流式响应")

  const decoder = new TextDecoder()
  let buffer = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n\n")
    buffer = lines.pop() ?? ""

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith("data:")) continue
      const json = trimmed.slice(5).trim()
      if (!json) continue
      onEvent(JSON.parse(json) as StreamEvent)
    }
  }
}

async function postEvidenceGap(payload: Record<string, unknown>, signal: AbortSignal): Promise<Response> {
  const response = await fetch("/api/evidence-gap", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "请求失败" }))
    throw new Error(typeof err?.error === "string" ? err.error : `HTTP ${response.status}`)
  }

  return response
}

export function useEvidenceGap() {
  const [state, setState] = useState<EvidenceGapStreamState>(
    () => fromPersisted(getPersistedEvidenceState()) ?? initialEvidenceGapState,
  )
  const abortRef = useRef<AbortController | null>(null)
  const stateRef = useRef(state)
  stateRef.current = state

  useEffect(() => {
    const saved = fromPersisted(getPersistedEvidenceState())
    if (saved && state.status === "idle") setState(saved)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (state.status === "idle") return
    saveEvidenceState(toPersisted(state))
  }, [state])

  const startGaps = useCallback(
    async (params: { jd: string; persona: PersonaResult; resume: string; analysisId?: string }) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      track(AnalyticsEvent.evidenceGapStarted, {
        analysis_id: params.analysisId,
        missing_keywords: params.persona.interviewKeywords.length,
      })

      setState(() => ({
        ...initialEvidenceGapState,
        analysisId: params.analysisId,
        status: "loading",
      }))

      let received = false

      try {
        const response = await postEvidenceGap(
          { action: "ask", jd: params.jd, persona: params.persona, resume: params.resume },
          controller.signal,
        )

        await readSse(response, (event) => {
          if (event.type === "evidence_gaps") {
            received = true
            const source: ResultSource = event.source ?? event.data.source ?? "model"
            track("evidence_gap_questions_ready", {
              analysis_id: params.analysisId,
              gap_count: event.data.gaps.length,
              source,
            })
            setState((prev) => ({
              ...prev,
              status: "questions",
              gaps: event.data.gaps,
              coachingNote: event.data.coachingNote,
              usedFallback: source === "fallback",
              streamInterrupted: false,
              error: null,
            }))
          } else if (event.type === "error") {
            track(AnalyticsEvent.evidenceGapFailed, {
              analysis_id: params.analysisId,
              message: event.message.slice(0, 120),
            })
          }
        })

        if (!received && !controller.signal.aborted) {
          const fallback = getFallbackEvidenceGaps()
          setState((prev) => ({
            ...prev,
            status: "questions",
            gaps: fallback.gaps,
            coachingNote: fallback.coachingNote,
            usedFallback: true,
            streamInterrupted: true,
            error: null,
          }))
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") return
        const fallback = getFallbackEvidenceGaps()
        setState((prev) => ({
          ...prev,
          status: "questions",
          gaps: fallback.gaps,
          coachingNote: fallback.coachingNote,
          usedFallback: true,
          streamInterrupted: true,
          error: null,
        }))
      }
    },
    [],
  )

  const setAnswer = useCallback((gapId: string, answer: string) => {
    setState((prev) => ({
      ...prev,
      error: null,
      answers: { ...prev.answers, [gapId]: answer },
      skippedGapIds: prev.skippedGapIds.filter((id) => id !== gapId),
    }))
  }, [])

  const commitAnswer = useCallback((gapId: string) => {
    const answer = stateRef.current.answers[gapId] ?? ""
    if (!answer.trim()) return
    track(AnalyticsEvent.evidenceGapAnswered, { gap_id: gapId, chars: answer.length })
  }, [])

  const skipGap = useCallback((gapId: string) => {
    setState((prev) => ({
      ...prev,
      error: null,
      answers: { ...prev.answers, [gapId]: "" },
      skippedGapIds: prev.skippedGapIds.includes(gapId)
        ? prev.skippedGapIds
        : [...prev.skippedGapIds, gapId],
    }))
  }, [])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setState(initialEvidenceGapState)
    saveEvidenceState({
      status: "idle",
      gaps: [],
      coachingNote: "",
      answers: {},
      skippedGapIds: [],
      result: null,
      error: null,
      usedFallback: false,
    })
  }, [])

  return { state, startGaps, setAnswer, commitAnswer, skipGap, reset }
}
