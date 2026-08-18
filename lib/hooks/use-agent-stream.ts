"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type {
  AgentAnalysisResult,
  AgentPhase,
  OutlineResult,
  PersonaResult,
  ResultSource,
  RewriteResult,
  StreamEvent,
} from "@/lib/agent/types"
import {
  clearInterviewInWorkspace,
  getPersistedAgentState,
  patchWorkspace,
  saveAgentProgress,
} from "@/lib/workspace-session"
import {
  getFallbackOutline,
  getFallbackPersona,
  getFallbackRewrite,
} from "@/lib/agent/fallback-content"
import { AnalyticsEvent, track } from "@/lib/analytics"
import { saveHistoryRecord } from "@/lib/history-storage"

export type AnalysisStatus = "idle" | "streaming" | "done" | "error"

export interface AgentStreamState {
  status: AnalysisStatus
  currentPhase: AgentPhase | null
  /** 当前阶段服务端状态文案（不展示模型原始 JSON） */
  phaseMessage: string | null
  reasoningByPhase: Record<AgentPhase, string>
  reasoningText: string
  persona: PersonaResult | null
  outline: OutlineResult | null
  rewrite: RewriteResult | null
  error: string | null
  source?: ResultSource | null
  usedFallback?: boolean
  /** 流中断后前端切换示例提示 */
  streamInterrupted?: boolean
}

export const initialAgentStreamState: AgentStreamState = {
  status: "idle",
  currentPhase: null,
  phaseMessage: null,
  reasoningByPhase: { A: "", B: "", C: "", D: "" },
  reasoningText: "",
  persona: null,
  outline: null,
  rewrite: null,
  error: null,
  source: null,
  usedFallback: false,
  streamInterrupted: false,
}

function applyEvent(prev: AgentStreamState, event: StreamEvent): AgentStreamState {
  switch (event.type) {
    case "phase":
      return {
        ...prev,
        currentPhase: event.status === "start" ? event.phase : prev.currentPhase,
        phaseMessage:
          event.status === "start"
            ? event.message ?? prev.phaseMessage
            : event.status === "error"
              ? event.message ?? prev.phaseMessage
              : prev.phaseMessage,
        status: event.status === "error" ? "error" : "streaming",
        error: event.status === "error" ? event.message ?? "阶段执行失败" : null,
      }
    case "reasoning": {
      const phaseText = prev.reasoningByPhase[event.phase] + event.content
      return {
        ...prev,
        currentPhase: event.phase,
        reasoningByPhase: { ...prev.reasoningByPhase, [event.phase]: phaseText },
        reasoningText: prev.reasoningText + event.content,
      }
    }
    case "result": {
      const source = event.source ?? prev.source ?? "model"
      const usedFallback = source === "fallback" || Boolean(prev.usedFallback)
      if (event.phase === "A") {
        return {
          ...prev,
          persona: event.data as PersonaResult,
          source,
          usedFallback,
        }
      }
      if (event.phase === "B") {
        return {
          ...prev,
          outline: event.data as OutlineResult,
          source,
          usedFallback,
        }
      }
      return {
        ...prev,
        rewrite: event.data as RewriteResult,
        source,
        usedFallback,
      }
    }
    case "done":
      return {
        ...prev,
        status: "done",
        persona: event.data.persona,
        outline: event.data.outline,
        rewrite: event.data.rewrite,
        source: event.source ?? event.data.source ?? prev.source ?? "model",
        usedFallback:
          (event.source ?? event.data.source) === "fallback" || Boolean(prev.usedFallback),
        streamInterrupted: false,
      }
    case "error":
      return { ...prev, status: "error", error: event.message }
    default:
      return prev
  }
}

export function useAgentStream() {
  // 首屏固定 idle，避免 localStorage 完成态与 SSR 不一致导致 hydration 报错
  const [state, setState] = useState<AgentStreamState>(initialAgentStreamState)
  const abortRef = useRef<AbortController | null>(null)
  const stateRef = useRef(state)
  stateRef.current = state

  // 挂载后再恢复（软跳转内存 / localStorage）
  useEffect(() => {
    const saved = getPersistedAgentState()
    if (saved) setState(saved)
  }, [])

  // 增量持久化：每完成一个阶段 / 完成整轮都写入
  useEffect(() => {
    if (state.status === "idle") return
    if (state.persona || state.outline || state.rewrite || state.status === "streaming") {
      saveAgentProgress(state, state.currentPhase)
    }
  }, [state])

  const reset = useCallback(() => {
    abortRef.current?.abort()
    setState(initialAgentStreamState)
    patchWorkspace({ agent: initialAgentStreamState, resumePhase: null })
  }, [])

  const analyze = useCallback(async (jd: string, resume: string) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const hasResume = Boolean(resume.trim())
    const startedAt = Date.now()
    track(AnalyticsEvent.analysisStarted, {
      has_resume: hasResume,
      jd_chars: jd.length,
      resume_chars: resume.trim().length,
    })

    // 新分析开始：清掉旧面试结果，避免串场
    clearInterviewInWorkspace()
    setState({ ...initialAgentStreamState, status: "streaming" })
    patchWorkspace({
      agent: { ...initialAgentStreamState, status: "streaming" },
      inputs: { lastJd: jd, jd, resume },
      resumePhase: "A",
    })

    let receivedDone = false

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jd, resume }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "请求失败", code: "" }))
        const message = err.error ?? `HTTP ${response.status}`
        // 配置缺失：直接报错，不要灌示例简历掩盖问题
        if (response.status === 503 || err.code === "AI_CONFIG_ERROR") {
          track(AnalyticsEvent.analysisFailed, {
            has_resume: hasResume,
            message: message.slice(0, 120),
          })
          setState({
            ...initialAgentStreamState,
            status: "error",
            error: message,
            usedFallback: false,
            streamInterrupted: false,
          })
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
          if (event.type === "done") {
            receivedDone = true
            track(AnalyticsEvent.analysisCompleted, {
              has_resume: hasResume,
              duration_ms: Date.now() - startedAt,
            })
            // 完整生成成功后写入本地历史记录
            try {
              saveHistoryRecord({
                persona: event.data.persona,
                rewrite: event.data.rewrite,
                jd,
                resume,
              })
            } catch {
              // 历史写入失败不影响主流程
            }
          } else if (event.type === "error") {
            track(AnalyticsEvent.analysisFailed, {
              has_resume: hasResume,
              message: event.message.slice(0, 120),
            })
          }
          setState((prev) => applyEvent(prev, event))
        }
      }

      // SSE 正常结束但未收到 done：视为流中断，灌入示例数据
      if (!receivedDone && !controller.signal.aborted) {
        setState((prev) => {
          if (prev.status === "done" && prev.rewrite) {
            return { ...prev, usedFallback: prev.usedFallback, streamInterrupted: true }
          }
          return {
            ...prev,
            status: "done",
            persona: prev.persona ?? getFallbackPersona(),
            outline: prev.outline ?? getFallbackOutline(),
            rewrite: prev.rewrite ?? getFallbackRewrite(),
            usedFallback: true,
            streamInterrupted: true,
            source: "fallback",
            error: null,
          }
        })
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") return
      const message = error instanceof Error ? error.message : "分析失败"
      track(AnalyticsEvent.analysisFailed, {
        has_resume: hasResume,
        message: message.slice(0, 120),
      })
      // 配置类错误不要用示例数据掩盖
      if (/OPENAI_API_KEY|未配置有效|AI_CONFIG_ERROR|Incorrect API key|Unauthorized/i.test(message)) {
        setState({
          ...initialAgentStreamState,
          status: "error",
          error: message,
          usedFallback: false,
          streamInterrupted: false,
        })
        return
      }
      setState((prev) => ({
        ...prev,
        status: "done",
        persona: prev.persona ?? getFallbackPersona(),
        outline: prev.outline ?? getFallbackOutline(),
        rewrite: prev.rewrite ?? getFallbackRewrite(),
        streamInterrupted: true,
        usedFallback: true,
        source: "fallback",
        error: null,
      }))
    }
  }, [])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    setState((prev) => ({ ...prev, status: prev.status === "streaming" ? "idle" : prev.status }))
  }, [])

  return { state, analyze, reset, cancel, setState }
}

export type { AgentAnalysisResult }
