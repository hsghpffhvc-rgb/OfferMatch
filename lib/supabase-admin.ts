import "server-only"

import type { PersonaResult, RewriteResult, ResultSource } from "@/lib/agent/types"
import type { FeedbackPayload } from "@/types/feedback"

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "")
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export interface AnalysisSessionInsert {
  session_id: string
  anonymous_id?: string | null
  posthog_distinct_id?: string | null
  title: string
  industry: string
  score_before: number
  score_after: number
  label: string
  has_resume: boolean
  jd_chars: number
  resume_chars: number
  jd_preview: string
  source?: ResultSource | null
  persona: PersonaResult
  rewrite: RewriteResult
  page_url?: string | null
  user_agent?: string | null
}

export interface AnalysisSessionRow extends AnalysisSessionInsert {
  id: string
  created_at: string
}

export interface FeedbackInsert {
  type: FeedbackPayload["type"]
  steps?: string[] | null
  reproducible?: boolean | null
  error_text?: string | null
  message?: string | null
  contact?: string | null
  rating?: number | null
  page?: string | null
  status?: string
  user_agent?: string | null
}

export interface FeedbackRow extends FeedbackInsert {
  id: string
  created_at: string
}

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SERVICE_ROLE_KEY)
}

async function supabaseRequest<T>(
  table: string,
  init: RequestInit & { query?: URLSearchParams } = {},
): Promise<T> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error("Supabase is not configured")
  }

  const query = init.query?.toString()
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}${query ? `?${query}` : ""}`,
    {
      ...init,
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
      cache: "no-store",
    },
  )

  if (!response.ok) {
    const detail = await response.text().catch(() => "")
    throw new Error(`Supabase ${response.status}: ${detail || response.statusText}`)
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export async function saveAnalysisSession(
  input: AnalysisSessionInsert,
): Promise<AnalysisSessionRow | null> {
  if (!isSupabaseConfigured()) return null
  const rows = await supabaseRequest<AnalysisSessionRow[]>("analysis_sessions", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(input),
  })
  return rows[0] ?? null
}

export async function saveFeedback(input: FeedbackInsert): Promise<FeedbackRow | null> {
  if (!isSupabaseConfigured()) return null
  const rows = await supabaseRequest<FeedbackRow[]>("feedback", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(input),
  })
  return rows[0] ?? null
}

export async function listRecentAnalysisSessions(limit = 100): Promise<AnalysisSessionRow[]> {
  if (!isSupabaseConfigured()) return []
  const query = new URLSearchParams({
    select:
      "id,created_at,session_id,anonymous_id,posthog_distinct_id,title,industry,score_before,score_after,label,has_resume,jd_chars,resume_chars,jd_preview,source,page_url,user_agent",
    order: "created_at.desc",
    limit: String(limit),
  })
  return supabaseRequest<AnalysisSessionRow[]>("analysis_sessions", { query })
}

export async function listRecentFeedback(limit = 100): Promise<FeedbackRow[]> {
  if (!isSupabaseConfigured()) return []
  const query = new URLSearchParams({
    select: "*",
    order: "created_at.desc",
    limit: String(limit),
  })
  return supabaseRequest<FeedbackRow[]>("feedback", { query })
}
