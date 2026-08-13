import "server-only"

import { createCanvas } from "@napi-rs/canvas"
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs"
import { createWorker } from "tesseract.js"

/** 可提取文本少于此阈值时，判定为扫描版 PDF 并启用 OCR */
const MIN_MEANINGFUL_CHARS = 40

export function needsOcrFallback(text: string): boolean {
  const compact = text.replace(/\s+/g, "")
  const meaningful = compact.replace(/[^\u4e00-\u9fffA-Za-z0-9]/g, "")
  const replacementChars = (text.match(/\uFFFD/g) ?? []).length
  const meaningfulRatio = compact.length ? meaningful.length / compact.length : 0

  // 有文本层不等于文本可用：乱码 PDF 往往仍会返回大量不可见或替换字符。
  return (
    meaningful.length < MIN_MEANINGFUL_CHARS ||
    replacementChars > 0 ||
    meaningfulRatio < 0.35
  )
}

function getOcrMaxPages(): number {
  const parsed = Number(process.env.OCR_MAX_PAGES)
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 30) : 15
}

function getOcrLanguages(): string {
  return process.env.TESSERACT_LANG?.trim() || "chi_sim+eng"
}

async function pdfToPageImages(buffer: Buffer, maxPages: number): Promise<Buffer[]> {
  const doc = await getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    disableFontFace: true,
  }).promise

  const pageCount = Math.min(doc.numPages, maxPages)
  const images: Buffer[] = []

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await doc.getPage(pageNum)
    const viewport = page.getViewport({ scale: 2.5 })
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
    const ctx = canvas.getContext("2d")

    await page.render({
      canvas: canvas as unknown as HTMLCanvasElement,
      canvasContext: ctx as unknown as CanvasRenderingContext2D,
      viewport,
    }).promise

    images.push(canvas.toBuffer("image/png"))
  }

  return images
}

export async function ocrPdfBuffer(buffer: Buffer): Promise<{
  text: string
  pageCount: number
}> {
  const maxPages = getOcrMaxPages()
  const images = await pdfToPageImages(buffer, maxPages)

  if (!images.length) {
    throw new Error("PDF 没有可识别的页面")
  }

  const worker = await createWorker(getOcrLanguages())
  const parts: string[] = []

  try {
    for (const image of images) {
      const { data } = await worker.recognize(image)
      const pageText = data.text?.replace(/\r\n/g, "\n").trim()
      if (pageText) parts.push(pageText)
    }
  } finally {
    await worker.terminate()
  }

  const text = parts.join("\n\n").trim()
  if (!text) {
    throw new Error("OCR 未能从扫描版 PDF 中识别出文字，请确认扫描清晰、文字可读")
  }

  return { text, pageCount: images.length }
}
