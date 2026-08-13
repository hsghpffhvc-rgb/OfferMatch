import "server-only"

import {
  getExtension,
  isSupportedExtension,
} from "@/lib/document/constants"
import { extractPdfText } from "@/lib/document/pdf-text"
import { needsOcrFallback, ocrPdfBuffer } from "@/lib/document/ocr-pdf"
import { extractResumePhoto } from "@/lib/document/pdf-photo"

export type ParseMethod = "text" | "ocr"

export interface ParseDocumentResult {
  text: string
  method: ParseMethod
  pageCount?: number
  photo?: string
}

async function parsePdfBuffer(buffer: Buffer): Promise<ParseDocumentResult> {
  let extracted = ""

  try {
    extracted = await extractPdfText(buffer)
  } catch {
    // 文本层提取失败时继续尝试 OCR
    extracted = ""
  }

  const photo = await extractResumePhoto(buffer).catch(() => "")

  if (!needsOcrFallback(extracted)) {
    return { text: extracted, method: "text", photo: photo || "" }
  }

  const ocr = await ocrPdfBuffer(buffer)
  return {
    text: ocr.text,
    method: "ocr",
    pageCount: ocr.pageCount,
    photo: photo || "",
  }
}

export async function parseDocumentBuffer(
  buffer: Buffer,
  filename: string,
): Promise<ParseDocumentResult> {
  const ext = getExtension(filename)
  if (!isSupportedExtension(ext)) {
    throw new Error(`不支持的文件格式：${ext || "未知"}`)
  }

  let parsed: ParseDocumentResult

  switch (ext) {
    case ".txt":
    case ".md": {
      const text = buffer.toString("utf-8").replace(/\r\n/g, "\n").trim()
      parsed = { text, method: "text" }
      break
    }
    case ".pdf":
      parsed = await parsePdfBuffer(buffer)
      break
    case ".docx": {
      const mammoth = await import("mammoth")
      const result = await mammoth.extractRawText({ buffer })
      parsed = { text: result.value, method: "text" }
      break
    }
    case ".doc": {
      const WordExtractor = (await import("word-extractor")).default
      const extractor = new WordExtractor()
      const doc = await extractor.extract(buffer)
      parsed = { text: doc.getBody(), method: "text" }
      break
    }
    default:
      throw new Error(`不支持的文件格式：${ext}`)
  }

  if (!parsed.text.trim()) {
    throw new Error("未能从文件中提取到文本内容")
  }

  return parsed
}
