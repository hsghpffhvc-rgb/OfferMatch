import "server-only"
import https from "node:https"
import { unstable_cache } from "next/cache"
import { parseAnalyticsRows, type AnalyticsRow } from "@/lib/admin-analytics"

export type Report = { status: "ready"; rows: AnalyticsRow[]; updatedAt: string } | { status: "error"; message: string }

class PostHogQueryError extends Error {
  constructor(public readonly userMessage: string, message = userMessage) {
    super(message)
  }
}

async function postHogQuery(sql: string, host: string, project: string) {
  const key = process.env.POSTHOG_PERSONAL_API_KEY
  if (!key) throw new PostHogQueryError("PostHog 尚未配置")

  const url = new URL(`/api/projects/${encodeURIComponent(project)}/query/`, host)
  const body = JSON.stringify({ query: { kind: "HogQLQuery", query: sql }, refresh: "blocking" })

  return new Promise<{ rows: AnalyticsRow[]; updatedAt: string }>((resolve, reject) => {
    const request = https.request({
      hostname: url.hostname, path: url.pathname, method: "POST", family: 4, timeout: 20000,
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
    }, (response) => {
      let raw = ""
      response.setEncoding("utf8")
      response.on("data", (chunk) => { raw += chunk })
      response.on("end", () => {
        let data: unknown
        try { data = JSON.parse(raw) } catch { data = null }

        if (!response.statusCode || response.statusCode < 200 || response.statusCode >= 300) {
          if (response.statusCode === 401 || response.statusCode === 403) {
            reject(new PostHogQueryError("PostHog API Key 无效或没有该项目的查询权限。"))
            return
          }
          reject(new PostHogQueryError(`PostHog 查询失败，HTTP ${response.statusCode ?? "未知"}。`))
          return
        }

        const results = data && typeof data === "object" && "results" in data ? (data as { results?: unknown }).results : undefined
        resolve({ rows: parseAnalyticsRows(results), updatedAt: new Date().toISOString() })
      })
    })

    request.on("timeout", () => request.destroy(new PostHogQueryError("PostHog 连接超时，请检查本机网络、代理或项目区域。")))
    request.on("error", (error) => {
      reject(error instanceof PostHogQueryError ? error : new PostHogQueryError("PostHog 网络连接失败，请检查本机网络、代理或项目区域。"))
    })
    request.end(body)
  })
}

const query = unstable_cache(async (sql: string, host: string, project: string) => {
  return postHogQuery(sql, host, project)
}, ["admin-reports-v1"], { revalidate: 300 })

export async function loadReport(sql: string): Promise<Report> {
  if (!process.env.POSTHOG_PERSONAL_API_KEY || !process.env.POSTHOG_PROJECT_ID) return { status: "error", message: "PostHog 尚未配置" }
  try {
    const host = new URL(process.env.POSTHOG_API_HOST || "https://us.posthog.com")
    if (host.protocol !== "https:" || host.username || host.password) throw new Error("Invalid host")
    return { status: "ready", ...await query(sql, host.origin, process.env.POSTHOG_PROJECT_ID) }
  } catch (error) {
    return { status: "error", message: error instanceof PostHogQueryError ? error.userMessage : "PostHog 数据暂不可用，请检查连接或查询权限。" }
  }
}
