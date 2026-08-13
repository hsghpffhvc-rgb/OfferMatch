import {
  MAX_FILE_SIZE_BYTES,
  validateFile,
} from "@/lib/document/constants"
import { parseDocumentBuffer } from "@/lib/document/parse-server"

export const runtime = "nodejs"
export const maxDuration = 120

export async function POST(request: Request) {
  let formData: FormData

  try {
    formData = await request.formData()
  } catch {
    return Response.json({ error: "无法解析上传数据" }, { status: 400 })
  }

  const file = formData.get("file")
  if (!file || !(file instanceof File)) {
    return Response.json({ error: "请上传文件（file 字段）" }, { status: 400 })
  }

  const validation = validateFile({
    name: file.name,
    size: file.size,
    type: file.type,
  })

  if (!validation.ok) {
    return Response.json({ error: validation.error }, { status: 400 })
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return Response.json({ error: "文件大小超过 10MB 限制" }, { status: 400 })
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const parsed = await parseDocumentBuffer(buffer, file.name)

    return Response.json({
      text: parsed.text,
      filename: file.name,
      charCount: parsed.text.length,
      extension: validation.ext,
      method: parsed.method,
      pageCount: parsed.pageCount,
      photo: parsed.photo ?? "",
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "文件解析失败，请稍后重试"
    return Response.json({ error: message }, { status: 422 })
  }
}
