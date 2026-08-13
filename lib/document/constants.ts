export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10MB

export const SUPPORTED_EXTENSIONS = [".pdf", ".doc", ".docx", ".txt", ".md"] as const

export type SupportedExtension = (typeof SUPPORTED_EXTENSIONS)[number]

const EXTENSION_MIME: Record<SupportedExtension, string[]> = {
  ".pdf": [
    "application/pdf",
    "application/x-pdf",
    "application/acrobat",
    "applications/vnd.pdf",
    "text/pdf",
  ],
  ".doc": ["application/msword"],
  ".docx": [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  ".txt": ["text/plain"],
  ".md": ["text/markdown", "text/plain"],
}

export function getExtension(filename: string): string {
  const dot = filename.lastIndexOf(".")
  if (dot === -1) return ""
  return filename.slice(dot).toLowerCase()
}

export function isSupportedExtension(ext: string): ext is SupportedExtension {
  return SUPPORTED_EXTENSIONS.includes(ext as SupportedExtension)
}

export function validateFile(file: { name: string; size: number; type?: string }) {
  const ext = getExtension(file.name)

  if (!isSupportedExtension(ext)) {
    return {
      ok: false as const,
      error: `不支持的文件格式，请上传 ${SUPPORTED_EXTENSIONS.join("、")} 文件`,
    }
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      ok: false as const,
      error: "文件大小超过 10MB 限制",
    }
  }

  if (file.size === 0) {
    return { ok: false as const, error: "文件为空，请重新选择" }
  }

  if (file.type) {
    const allowed = EXTENSION_MIME[ext]
    const genericType =
      file.type === "application/octet-stream" ||
      file.type === "" ||
      file.type === "binary/octet-stream"
    const typeOk = genericType || allowed.includes(file.type)

    // 浏览器对 PDF/Office 的 MIME 报告不一致，以扩展名为准
    const trustExtension = [".pdf", ".doc", ".docx"].includes(ext)

    if (!typeOk && !trustExtension) {
      return {
        ok: false as const,
        error: `文件类型与扩展名不匹配（${file.type}）`,
      }
    }
  }

  return { ok: true as const, ext }
}

export const FILE_ACCEPT =
  ".pdf,.doc,.docx,.txt,.md,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"

export function truncateFilename(name: string, max = 18): string {
  if (name.length <= max) return name
  const ext = getExtension(name)
  const base = name.slice(0, name.length - ext.length)
  const keep = max - ext.length - 1
  return `${base.slice(0, Math.max(keep, 4))}…${ext}`
}
