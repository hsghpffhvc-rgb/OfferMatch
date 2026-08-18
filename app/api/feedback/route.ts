import { mkdir, appendFile } from "fs/promises"
import path from "path"

import { parseFeedbackBody } from "@/lib/feedback/validate"

export const runtime = "nodejs"
export const maxDuration = 30

const DATA_DIR = path.join(process.cwd(), "data")
const DATA_FILE = path.join(DATA_DIR, "feedback.jsonl")

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "请求体必须是合法 JSON" }, { status: 400 })
  }

  const parsed = parseFeedbackBody(body)
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 })
  }

  const record = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status: "open",
    ...parsed.data,
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
