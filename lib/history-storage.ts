import type { InterviewResult, PersonaResult, RewriteResult } from "@/lib/agent/types"
import type { PersistedAgentState, PersistedInterviewState } from "@/lib/workspace-session"
import { patchWorkspace } from "@/lib/workspace-session"

const HISTORY_KEY = "offermatch:history:v1"
const MAX_RECORDS = 20
/** 原始简历文本最多保留字符，避免撑爆 localStorage */
const MAX_RESUME_CHARS = 20_000
const MAX_JD_CHARS = 8_000

export interface HistoryRecord {
  id: string
  createdAt: number
  /** 列表展示：岗位名 */
  title: string
  industry: string
  overallAfter: number
  label: string
  /** JD 摘要 */
  jdPreview: string
  hasResume: boolean
  persona: PersonaResult
  rewrite: RewriteResult
  /** 模拟面试（可能尚未生成） */
  interview: InterviewResult | null
  /** 恢复工作台用 */
  jd: string
  resume: string
}

function canUseStorage(): boolean {
  return typeof window !== "undefined"
}

function createId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `h-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function normalizeRecord(raw: Partial<HistoryRecord> & { id: string }): HistoryRecord | null {
  if (!raw.persona || !raw.rewrite) return null
  return {
    id: raw.id,
    createdAt: typeof raw.createdAt === "number" ? raw.createdAt : Date.now(),
    title: raw.title ?? "未命名岗位",
    industry: raw.industry ?? "",
    overallAfter: raw.overallAfter ?? 0,
    label: raw.label ?? "",
    jdPreview: raw.jdPreview ?? "",
    hasResume: Boolean(raw.hasResume),
    persona: raw.persona,
    rewrite: raw.rewrite,
    interview: raw.interview ?? null,
    jd: raw.jd ?? "",
    resume: raw.resume ?? "",
  }
}

export function listHistoryRecords(): HistoryRecord[] {
  if (!canUseStorage()) return []
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item) => normalizeRecord(item as Partial<HistoryRecord> & { id: string }))
      .filter((item): item is HistoryRecord => item !== null)
      .sort((a, b) => b.createdAt - a.createdAt)
  } catch {
    return []
  }
}

function writeAll(records: HistoryRecord[]): void {
  if (!canUseStorage()) return
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(records))
  } catch {
    // 配额不足：丢掉最旧记录后重试
    if (records.length <= 1) return
    try {
      localStorage.setItem(
        HISTORY_KEY,
        JSON.stringify(records.slice(0, Math.max(1, records.length - 3))),
      )
    } catch {
      // ignore
    }
  }
}

export function getHistoryRecord(id: string): HistoryRecord | null {
  return listHistoryRecords().find((item) => item.id === id) ?? null
}

export function deleteHistoryRecord(id: string): void {
  writeAll(listHistoryRecords().filter((item) => item.id !== id))
}

export function clearHistoryRecords(): void {
  if (!canUseStorage()) return
  try {
    localStorage.removeItem(HISTORY_KEY)
  } catch {
    // ignore
  }
}

/** 一次完整简历生成完成后写入本地历史（面试稍后可追加） */
export function saveHistoryRecord(input: {
  persona: PersonaResult
  rewrite: RewriteResult
  jd: string
  resume: string
  interview?: InterviewResult | null
}): HistoryRecord {
  const jd = input.jd.trim().slice(0, MAX_JD_CHARS)
  const resume = input.resume.trim().slice(0, MAX_RESUME_CHARS)
  const record: HistoryRecord = {
    id: createId(),
    createdAt: Date.now(),
    title: input.persona.title?.trim() || "未命名岗位",
    industry: input.persona.industry?.trim() || "",
    overallAfter: input.rewrite.scores?.overallAfter ?? 0,
    label: input.rewrite.scores?.label ?? "",
    jdPreview: jd.slice(0, 80),
    hasResume: resume.length > 0,
    persona: input.persona,
    rewrite: input.rewrite,
    interview: input.interview ?? null,
    jd,
    resume,
  }

  const next = [record, ...listHistoryRecords().filter((item) => item.id !== record.id)].slice(
    0,
    MAX_RECORDS,
  )
  writeAll(next)
  return record
}

/**
 * 模拟面试完成后，把结果挂到「最近一条」历史记录上。
 * 用户路径通常是：先生成简历 → 再出面试题，对应同一条记录。
 */
export function attachInterviewToLatestHistory(interview: InterviewResult): boolean {
  const records = listHistoryRecords()
  if (!records.length) return false
  const [latest, ...rest] = records
  writeAll([{ ...latest, interview }, ...rest])
  return true
}

/** 将某条历史恢复到当前工作台（含面试结果，若有） */
export function restoreHistoryToWorkspace(record: HistoryRecord): void {
  const agent: PersistedAgentState = {
    status: "done",
    currentPhase: "C",
    phaseMessage: "已从历史记录恢复",
    reasoningByPhase: { A: "", B: "", C: "", D: "" },
    reasoningText: "",
    persona: record.persona,
    outline: null,
    rewrite: record.rewrite,
    error: null,
  }
  const interviewState: PersistedInterviewState = record.interview
    ? { status: "done", interview: record.interview, error: null }
    : { status: "idle", interview: null, error: null }

  patchWorkspace({
    agent,
    interview: interviewState,
    inputs: {
      jd: record.jd,
      resume: record.resume,
      lastJd: record.jd,
      resumeFileName: record.hasResume ? "历史简历" : null,
      jdFileName: null,
      resumePhoto: null,
    },
  })
}

export function formatHistoryTime(ts: number): string {
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(ts))
  } catch {
    return new Date(ts).toLocaleString()
  }
}
