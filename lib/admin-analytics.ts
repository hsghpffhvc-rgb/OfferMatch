export const overviewMetrics = [
  ["$pageview", "", "访问产品人数"],
  ["resume_uploaded", "", "上传简历人数"],
  ["jd_uploaded", "", "上传 JD 人数"],
  ["analysis_started", "", "开始分析人数"],
  ["analysis_completed", "", "完成分析人数"],
  ["resume_copied", "", "复制人数"],
  ["pdf_exported", "downloaded", "下载 PDF 人数"],
  ["interview_started", "", "开始面试人数"],
] as const

const productionFilter = "properties.$host IN ('www.offermatch.cn', 'offermatch.cn') AND NOT match(coalesce(properties.$current_url, ''), '(^|/)admin(/|[?]|$)')"

export function overviewQuery(days: number) {
  if (![7, 14, 30].includes(days)) throw new Error("Invalid range")
  return `SELECT event, coalesce(properties.action, ''), count(DISTINCT person_id), avg(toFloat(properties.duration_ms)), count(properties.duration_ms)
    FROM events WHERE ${productionFilter} AND timestamp >= now() - INTERVAL ${days} DAY
    AND event IN ('$pageview','resume_uploaded','jd_uploaded','analysis_started','analysis_completed','resume_copied','pdf_exported','interview_started','analysis_first_response')
    GROUP BY event, coalesce(properties.action, '') LIMIT 100`
}

export function detailQuery(ids: string[]) {
  if (!ids.length || ids.length > 25 || ids.some(id => !/^[a-zA-Z0-9-]{1,100}$/.test(id))) throw new Error("Invalid analysis IDs")
  return `SELECT coalesce(properties.analysis_id, properties.session_id), event, coalesce(properties.action, ''), coalesce(properties.phase, ''), count(), avg(toFloat(properties.duration_ms)), min(timestamp)
    FROM events WHERE ${productionFilter}
    AND coalesce(properties.analysis_id, properties.session_id) IN (${ids.map(id => `'${id}'`).join(",")})
    AND event IN ('analysis_started','analysis_completed','analysis_first_response','analysis_phase_completed','resume_copied','pdf_exported','interview_started','interview_completed')
    GROUP BY coalesce(properties.analysis_id, properties.session_id), event, coalesce(properties.action, ''), coalesce(properties.phase, '') LIMIT 1000`
}

export type AnalyticsRow = (string | number | null)[]
export function parseAnalyticsRows(value: unknown): AnalyticsRow[] {
  if (!Array.isArray(value) || value.some(row => !Array.isArray(row) || row.some(cell => cell !== null && typeof cell !== "string" && typeof cell !== "number"))) throw new Error("Invalid analytics response")
  return value as AnalyticsRow[]
}

export function duration(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? `${(value / 1000).toFixed(1)} 秒` : "未知"
}
