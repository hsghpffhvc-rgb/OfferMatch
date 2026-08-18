"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { InterviewContext } from "@/lib/agent/interview-context"
import type { InterviewResult, ResultSource, StreamEvent } from "@/lib/agent/types"
import {
  getInterviewProgress,
  getPersistedInterviewState,
  patchWorkspace,
  saveInterviewAnswer,
  type InterviewProgress,
} from "@/lib/workspace-session"
import { getFallbackInterview } from "@/lib/agent/fallback-content"
import { AnalyticsEvent, track } from "@/lib/analytics"
import { attachInterviewToLatestHistory } from "@/lib/history-storage"

export type InterviewStatus = "idle" | "streaming" | "done" | "error"

export interface InterviewStreamState {
  status: InterviewStatus
  interview: InterviewResult | null
  error: string | null
  source?: ResultSource | null
  usedFallback?: boolean
  streamInterrupted?: boolean
  progress: InterviewProgress
}

export const initialInterviewStreamState: InterviewStreamState = {
  status: "idle",
  interview: null,
  error: null,
  source: null,
  usedFallback: false,
  streamInterrupted: false,
  progress: {
    currentQuestionIndex: 0,
    answers: {},
    submittedQuestionIds: [],
  },
}

export function useInterviewStream() {
  const [state, setState] = useState<InterviewStreamState>(
    initialInterviewStreamState,
  )
  const abortRef = useRef<AbortController | null>(null)

  // 挂载后再从 storage 恢复，避免 SSR hydration mismatch
  useEffect(() => {
    const saved = getPersistedInterviewState()
    if (!saved) return
    setState({
      status: saved.status,
      interview: saved.interview,
      error: saved.error,
      source: saved.source,
      usedFallback: saved.usedFallback,
      streamInterrupted: false,
      progress: saved.progress ?? getInterviewProgress(),
    })
  }, [])

  useEffect(() => {
    if (state.status === "done" && state.interview) {
      patchWorkspace({
        interview: {
          status: state.status,
          interview: state.interview,
          error: state.error,
          source: state.source,
          usedFallback: state.usedFallback,
          progress: state.progress,
        },
        resumePhase: "D",
      })
    }
  }, [state])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setState(initialInterviewStreamState)
    patchWorkspace({
      interview: {
        status: "idle",
        interview: null,
        error: null,
        source: null,
        usedFallback: false,
        progress: {
          currentQuestionIndex: 0,
          answers: {},
          submittedQuestionIds: [],
        },
      },
    })
  }, [])

  const submitAnswer = useCallback(
    (questionId: string, answer: string, currentQuestionIndex: number) => {
      saveInterviewAnswer({ questionId, answer, currentQuestionIndex })
      setState((prev) => {
        const submitted = prev.progress.submittedQuestionIds.includes(questionId)
          ? prev.progress.submittedQuestionIds
          : [...prev.progress.submittedQuestionIds, questionId]
        return {
          ...prev,
          progress: {
            currentQuestionIndex,
            answers: { ...prev.progress.answers, [questionId]: answer },
            submittedQuestionIds: submitted,
          },
        }
      })
    },
    [],
  )

  const startInterview = useCallback(
    async (jd: string, context: InterviewContext) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      const startedAt = Date.now()
      track(AnalyticsEvent.interviewStarted, {
        experience_count: context.experiences.length,
        skill_count: context.skills.length,
      })

      setState({
        ...initialInterviewStreamState,
        status: "streaming",
        progress: {
          currentQuestionIndex: 0,
          answers: {},
          submittedQuestionIds: [],
        },
      })

      let receivedDone = false

      try {
        const response = await fetch("/api/interview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jd, context }),
          signal: controller.signal,
        })

        if (!response.ok) {
          const err = await response.json().catch(() => ({ error: "请求失败" }))
          const message = err.error ?? `HTTP ${response.status}`
          // 题库未就绪等业务错误：不灌入示例面试，直接失败
          if (response.status === 503) {
            setState((prev) => ({
              ...prev,
              status: "error",
              error: message,
              streamInterrupted: false,
              usedFallback: false,
            }))
            return
          }
          throw new Error(message)
        }

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
            const event = JSON.parse(json) as StreamEvent

            if (event.type === "interview_done") {
              receivedDone = true
              track(AnalyticsEvent.interviewCompleted, {
                duration_ms: Date.now() - startedAt,
              })
            } else if (event.type === "error") {
              track(AnalyticsEvent.interviewFailed, {
                message: event.message.slice(0, 120),
              })
            }

            setState((prev) => {
              switch (event.type) {
                case "phase":
                  return {
                    ...prev,
                    status: event.status === "error" ? "error" : "streaming",
                    error: event.status === "error" ? event.message ?? "面试生成失败" : null,
                  }
                case "result": {
                  const interview = event.data as unknown as InterviewResult
                  const source = event.source ?? interview.source ?? "model"
                  // 把面试题与示范回答挂到最近一条简历历史
                  try {
                    attachInterviewToLatestHistory(interview)
                  } catch {
                    // 历史写入失败不影响主流程
                  }
                  return {
                    ...prev,
                    interview,
                    source,
                    usedFallback: source === "fallback",
                  }
                }
                case "interview_done":
                  return {
                    ...prev,
                    status: "done",
                    source: event.source ?? prev.source ?? "model",
                    usedFallback:
                      (event.source ?? event.data.source) === "fallback"
                      || Boolean(prev.usedFallback),
                    streamInterrupted: false,
                  }
                case "error":
                  return {
                    ...prev,
                    status: "error",
                    error: event.message,
                    streamInterrupted: true,
                  }
                default:
                  return prev
              }
            })
          }
        }

        if (!receivedDone && !controller.signal.aborted) {
          setState((prev) => ({
            ...prev,
            status: "done",
            interview: prev.interview ?? getFallbackInterview(),
            usedFallback: true,
            streamInterrupted: true,
            source: "fallback",
            error: null,
          }))
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") return
        track(AnalyticsEvent.interviewFailed, {
          message: error instanceof Error ? error.message.slice(0, 120) : "unknown",
        })
        setState((prev) => ({
          ...prev,
          status: "done",
          interview: prev.interview ?? getFallbackInterview(),
          streamInterrupted: true,
          usedFallback: true,
          source: "fallback",
          error: null,
        }))
      }
    },
    [],
  )

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    setState((prev) => ({
      ...prev,
      status: prev.status === "streaming" ? "idle" : prev.status,
    }))
  }, [])

  return { state, startInterview, reset, cancel, submitAnswer }
}
