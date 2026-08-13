import { mkdir, appendFile } from "fs/promises"
import path from "path"

export const runtime = "nodejs"
export const maxDuration = 30

const ALLOWED_CATEGORIES = ["suggestion", "bug", "cooperation", "other"] as const
type Category = (typeof ALLOWED_CATEGORIES)[number]

// 反馈数据落地到项目根目录 data/feedback.jsonl（每行一条 JSON）。
// 本地开发可直接查看；部署到 serverless 时该目录为临时存储，
// 如需持久化可改为写入数据库 / 转发邮件 / 上报 PostHog。
const DATA_DIR = path.join(process.cwd(), "data")
const DATA_FILE = path.join(DATA_DIR, "feedback.jsonl")

interface FeedbackPayload {
  category?: string
  rating?: unknown
  message?: unknown
  name?: unknown
  contact?: unknown
  wantReply?: unknown
  page?: unknown
}

export async function POST(request: Request) {
  let body: FeedbackPayload
  try {
    body = (await request.json()) as FeedbackPayload
  } catch {
    return Response.json({ error: "请求体必须是合法 JSON" }, { status: 400 })
  }

  const category = body.category
  if (!category || !ALLOWED_CATEGORIES.includes(category as Category)) {
    return Response.json({ error: "请选择反馈类型（category）" }, { status: 400 })
  }

  const message = typeof body.message === "string" ? body.message.trim() : ""
  if (message.length < 2 || message.length > 2000) {
    return Response.json({ error: "留言内容需在 2–2000 字之间" }, { status: 400 })
  }

  const wantReply = Boolean(body.wantReply)
  const contact = typeof body.contact === "string" ? body.contact.trim() : ""
  if (wantReply && contact.length < 3) {
    return Response.json({ error: "想收到回复的话，留个邮箱或微信吧" }, { status: 400 })
  }

  let rating: number | null = null
  if (body.rating !== undefined && body.rating !== null && body.rating !== "") {
    const n = Number(body.rating)
    if (!Number.isInteger(n) || n < 1 || n > 5) {
      return Response.json({ error: "评分需为 1–5 的整数" }, { status: 400 })
    }
    rating = n
  }

  const name = typeof body.name === "string" ? body.name.trim().slice(0, 50) : ""
  const page = typeof body.page === "string" ? body.page.slice(0, 200) : ""
  const contactSaved = contact.slice(0, 120)

  const record = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    category,
    rating,
    message,
    name,
    contact: contactSaved,
    wantReply: wantReply || Boolean(contactSaved),
    page,
    userAgent: request.headers.get("user-agent") ?? "",
  }

  try {
    await mkdir(DATA_DIR, { recursive: true })
    await appendFile(DATA_FILE, JSON.stringify(record) + "\n", "utf8")
  } catch (error) {
    const msg = error instanceof Error ? error.message : "保存失败"
    return Response.json({ error: `提交失败：${msg}` }, { status: 500 })
  }

  return Response.json({ ok: true })
}
