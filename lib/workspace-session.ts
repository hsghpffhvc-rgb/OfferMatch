import type {
  AgentPhase,
  InterviewResult,
  OutlineResult,
  PersonaResult,
  ResultSource,
  RewriteResult,
} from "@/lib/agent/types"

const STORAGE_KEY = "offermatch:workspace:v1"

/** 用户输入与上传元数据（跨路由保留） */
export interface WorkspaceInputs {
  jd: string
  resume: string
  resumeFileName: string | null
  jdFileName: string | null
  resumePhoto: string | null
  lastJd: string
}

/** 与 AgentStreamState 结构对齐，避免与 hooks 循环依赖 */
export interface PersistedAgentState {
  status: "idle" | "streaming" | "done" | "error"
  currentPhase: AgentPhase | null
  phaseMessage: string | null
  reasoningByPhase: Record<AgentPhase, string>
  reasoningText: string
  persona: PersonaResult | null
  outline: OutlineResult | null
  rewrite: RewriteResult | null
  error: string | null
  source?: ResultSource | null
  /** 流中断后已切到示例数据 */
  usedFallback?: boolean
}

export interface InterviewProgress {
  /** 当前题号（0-based） */
  currentQuestionIndex: number
  /** questionId -> 练习答案 */
  answers: Record<string, string>
  /** 已提交的题目 id */
  submittedQuestionIds: string[]
}

export interface PersistedInterviewState {
  status: "idle" | "streaming" | "done" | "error"
  interview: InterviewResult | null
  error: string | null
  source?: ResultSource | null
  usedFallback?: boolean
  progress?: InterviewProgress
}

export interface WorkspaceUiPrefs {
  /** 用户点过「暂不开始」模拟面试 */
  interviewPromptDismissed?: boolean
}

export interface WorkspaceSnapshot {
  agent: PersistedAgentState
  interview: PersistedInterviewState
  inputs: WorkspaceInputs
  updatedAt: number
  /** 未完成会话的滚动定位 phase */
  resumePhase?: AgentPhase | null
  ui?: WorkspaceUiPrefs
}

const emptyAgent: PersistedAgentState = {
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
}

const emptyInterviewProgress: InterviewProgress = {
  currentQuestionIndex: 0,
  answers: {},
  submittedQuestionIds: [],
}

const emptyInterview: PersistedInterviewState = {
  status: "idle",
  interview: null,
  error: null,
  source: null,
  usedFallback: false,
  progress: emptyInterviewProgress,
}

const emptyInputs: WorkspaceInputs = {
  jd: "",
  resume: "",
  resumeFileName: null,
  jdFileName: null,
  resumePhoto: null,
  lastJd: "",
}

/** 同页软跳转时保留（模块级）；关闭浏览器后靠 localStorage 恢复 */
let memory: WorkspaceSnapshot | null = null
let storageHydrated = false

function canUseBrowserStorage(): boolean {
  return typeof window !== "undefined"
}

function readStorageRaw(): string | null {
  if (!canUseBrowserStorage()) return null
  try {
    // 优先 localStorage（关闭浏览器仍可恢复）；兼容旧 sessionStorage
    return localStorage.getItem(STORAGE_KEY) ?? sessionStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function hydrateFromStorage(): void {
  if (storageHydrated || !canUseBrowserStorage()) return
  storageHydrated = true
  if (memory) return
  try {
    const raw = readStorageRaw()
    if (!raw) return
    memory = JSON.parse(raw) as WorkspaceSnapshot
  } catch {
    memory = null
  }
}

function writeStorage(snapshot: WorkspaceSnapshot): void {
  if (!canUseBrowserStorage()) return
  const payload = JSON.stringify(snapshot)
  try {
    localStorage.setItem(STORAGE_KEY, payload)
    // 清理旧的 session 副本，避免双源不一致
    try {
      sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
  } catch {
    // 配额不足时去掉大体积头像再试，保证核心分析结果可恢复
    try {
      const slim: WorkspaceSnapshot = {
        ...snapshot,
        inputs: { ...snapshot.inputs, resumePhoto: null },
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(slim))
    } catch {
      // 忽略持久化失败，仍保留内存快照供同页返回
    }
  }
}

export function getWorkspace(): WorkspaceSnapshot | null {
  hydrateFromStorage()
  return memory
}

function ensureSnapshot(): WorkspaceSnapshot {
  hydrateFromStorage()
  if (!memory) {
    memory = {
      agent: emptyAgent,
      interview: emptyInterview,
      inputs: emptyInputs,
      updatedAt: Date.now(),
      resumePhase: null,
    }
  }
  return memory
}

/** 合并写入工作区快照 */
export function patchWorkspace(partial: {
  agent?: PersistedAgentState
  interview?: PersistedInterviewState
  inputs?: Partial<WorkspaceInputs>
  resumePhase?: AgentPhase | null
  ui?: Partial<WorkspaceUiPrefs>
}): void {
  const current = ensureSnapshot()
  memory = {
    agent: partial.agent ?? current.agent,
    interview: partial.interview ?? current.interview,
    inputs: partial.inputs ? { ...current.inputs, ...partial.inputs } : current.inputs,
    updatedAt: Date.now(),
    resumePhase:
      partial.resumePhase !== undefined ? partial.resumePhase : current.resumePhase,
    ui: partial.ui ? { ...current.ui, ...partial.ui } : current.ui,
  }
  writeStorage(memory)
}

/** Phase C 每产出一段 / 阶段结果时增量保存 */
export function saveAgentProgress(
  agent: PersistedAgentState,
  resumePhase?: AgentPhase | null,
): void {
  patchWorkspace({
    agent,
    resumePhase: resumePhase ?? agent.currentPhase,
  })
}

/** Phase D 每答完一题立即保存 */
export function saveInterviewAnswer(params: {
  questionId: string
  answer: string
  currentQuestionIndex: number
}): void {
  const current = ensureSnapshot()
  const prevProgress = current.interview.progress ?? emptyInterviewProgress
  const submitted = prevProgress.submittedQuestionIds.includes(params.questionId)
    ? prevProgress.submittedQuestionIds
    : [...prevProgress.submittedQuestionIds, params.questionId]

  patchWorkspace({
    interview: {
      ...current.interview,
      progress: {
        currentQuestionIndex: params.currentQuestionIndex,
        answers: {
          ...prevProgress.answers,
          [params.questionId]: params.answer,
        },
        submittedQuestionIds: submitted,
      },
    },
    resumePhase: "D",
  })
}

export function getInterviewProgress(): InterviewProgress {
  return getWorkspace()?.interview.progress ?? { ...emptyInterviewProgress, answers: {} }
}

export function clearWorkspace(): void {
  memory = null
  if (canUseBrowserStorage()) {
    try {
      localStorage.removeItem(STORAGE_KEY)
      sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
  }
}

/** 开始新一轮分析时清掉面试结果，避免旧数据串场 */
export function clearInterviewInWorkspace(): void {
  patchWorkspace({
    interview: {
      ...emptyInterview,
      progress: { currentQuestionIndex: 0, answers: {}, submittedQuestionIds: [] },
    },
    ui: { interviewPromptDismissed: false },
  })
}

export function setInterviewPromptDismissed(dismissed: boolean): void {
  patchWorkspace({ ui: { interviewPromptDismissed: dismissed } })
}

export function isInterviewPromptDismissed(): boolean {
  return Boolean(getWorkspace()?.ui?.interviewPromptDismissed)
}

export function getPersistedAgentState(): PersistedAgentState | null {
  const agent = getWorkspace()?.agent
  if (!agent) return null
  // 完整完成态
  if (agent.status === "done" && agent.persona && agent.rewrite) return agent
  return null
}

/** 未完成但仍有进度的分析（用于恢复弹窗） */
export function getIncompleteAgentState(): PersistedAgentState | null {
  const agent = getWorkspace()?.agent
  if (!agent) return null
  if (agent.status === "done") return null
  const hasProgress = Boolean(agent.persona || agent.outline || agent.rewrite)
  const wasInterrupted = agent.status === "streaming" || agent.status === "error"
  if (hasProgress || wasInterrupted) return agent
  return null
}

export function getPersistedInterviewState(): PersistedInterviewState | null {
  const interview = getWorkspace()?.interview
  if (interview?.status === "done" && interview.interview) return interview
  return null
}

export function getIncompleteInterviewState(): PersistedInterviewState | null {
  const interview = getWorkspace()?.interview
  if (!interview) return null
  if (interview.status === "done" && interview.interview) {
    const progress = interview.progress
    // 面试题已出，但练习答题未全部完成 → 仍算可继续
    if (
      progress
      && interview.interview.questions.length > 0
      && progress.submittedQuestionIds.length > 0
      && progress.submittedQuestionIds.length < interview.interview.questions.length
    ) {
      return interview
    }
    return null
  }
  if (interview.status === "streaming" || interview.status === "error") return interview
  return null
}

export type IncompleteSessionKind = "analysis" | "interview" | "both" | "done"

export function detectIncompleteSession(): {
  kind: IncompleteSessionKind
  resumePhase: AgentPhase | null
  updatedAt: number
} | null {
  const snapshot = getWorkspace()
  if (!snapshot) return null

  const incompleteAgent = getIncompleteAgentState()
  const incompleteInterview = getIncompleteInterviewState()

  // 已完成分析但面试练习未做完
  const doneAgent = getPersistedAgentState()
  const interviewPracticeIncomplete =
    doneAgent
    && snapshot.interview.status === "done"
    && snapshot.interview.interview
    && (snapshot.interview.progress?.submittedQuestionIds.length ?? 0) > 0
    && (snapshot.interview.progress?.submittedQuestionIds.length ?? 0)
      < snapshot.interview.interview.questions.length

  if (incompleteAgent || incompleteInterview || interviewPracticeIncomplete) {
    let kind: IncompleteSessionKind = "analysis"
    if ((incompleteInterview || interviewPracticeIncomplete) && incompleteAgent) {
      kind = "both"
    } else if (incompleteInterview || interviewPracticeIncomplete) {
      kind = "interview"
    }

    return {
      kind,
      resumePhase:
        snapshot.resumePhase
        ?? incompleteAgent?.currentPhase
        ?? (kind === "interview" ? "D" : "A"),
      updatedAt: snapshot.updatedAt,
    }
  }

  // 分析已完成：也要用户确认「继续上次 / 开始新分析」，避免静默卡住旧状态
  if (doneAgent) {
    return {
      kind: "done",
      resumePhase: snapshot.resumePhase ?? "C",
      updatedAt: snapshot.updatedAt,
    }
  }

  return null
}

export function getPersistedInputs(): WorkspaceInputs {
  return getWorkspace()?.inputs ?? { ...emptyInputs }
}
