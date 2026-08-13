import {
  FILE_ACCEPT,
  getExtension,
  isSupportedExtension,
  MAX_FILE_SIZE_BYTES,
  truncateFilename,
  validateFile,
} from "@/lib/document/constants"

export type ParseMethod = "text" | "ocr"

export interface ExtractFileResult {
  text: string
  filename: string
  method?: ParseMethod
  pageCount?: number
  photo?: string
}

export async function extractFileText(file: File): Promise<ExtractFileResult> {
  const validation = validateFile({
    name: file.name,
    size: file.size,
    type: file.type,
  })

  if (!validation.ok) {
    throw new Error(validation.error)
  }

  const ext = getExtension(file.name)

  // 纯文本在客户端直接读取，无需请求服务端
  if (ext === ".txt" || ext === ".md") {
    const text = (await file.text()).trim()
    if (!text) throw new Error("文件内容为空")
    return { text, filename: file.name, method: "text" }
  }

  if (!isSupportedExtension(ext)) {
    throw new Error("不支持的文件格式")
  }

  const formData = new FormData()
  formData.append("file", file)

  const response = await fetch("/api/parse-document", {
    method: "POST",
    body: formData,
  })

  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(data.error ?? `上传失败（HTTP ${response.status}）`)
  }

  return {
    text: data.text as string,
    filename: data.filename as string,
    method: data.method as ParseMethod | undefined,
    pageCount: data.pageCount as number | undefined,
    photo: data.photo as string | undefined,
  }
}

export { FILE_ACCEPT, MAX_FILE_SIZE_BYTES, truncateFilename }
