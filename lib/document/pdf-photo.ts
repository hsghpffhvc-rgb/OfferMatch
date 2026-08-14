import "server-only"

import { createCanvas } from "@napi-rs/canvas"
import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs"
import { ensurePdfjsWorker } from "@/lib/document/ensure-pdf-worker"

export interface PdfPhotoCandidate {
  dataUrl: string
  width: number
  height: number
  x: number
  y: number
  pageWidth: number
  pageHeight: number
}

export interface PdfPhotoOptions {
  minAspectRatio?: number
  maxAspectRatio?: number
  minArea?: number
  topRegionRatio?: number
}

const DEFAULT_OPTIONS: Required<PdfPhotoOptions> = {
  minAspectRatio: 0.7,
  maxAspectRatio: 1.3,
  minArea: 10000,
  topRegionRatio: 0.3,
}

function isImageDataLike(value: any): value is { width: number; height: number; data: Uint8ClampedArray } {
  return Boolean(value && typeof value.width === "number" && typeof value.height === "number" && value.data)
}

function imageToDataUrl(image: any): string {
  if (!image) return ""
  if (typeof image === "string") return image
  if (image.src && typeof image.src === "string") return image.src
  if (image.dataUrl && typeof image.dataUrl === "string") return image.dataUrl

  if (isImageDataLike(image)) {
    const canvas = createCanvas(image.width, image.height)
    const ctx = canvas.getContext("2d")
    const imageData = ctx.createImageData(image.width, image.height)
    imageData.data.set(image.data)
    ctx.putImageData(imageData, 0, 0)
    return canvas.toDataURL("image/png")
  }

  if (image?.canvas && typeof image.canvas.toDataURL === "function") {
    return image.canvas.toDataURL("image/png")
  }

  return ""
}

function multiplyTransform(a: number[], b: number[]): number[] {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ]
}

function transformPoint(matrix: number[], x: number, y: number) {
  return {
    x: matrix[0] * x + matrix[2] * y + matrix[4],
    y: matrix[1] * x + matrix[3] * y + matrix[5],
  }
}

function bboxFromTransform(matrix: number[]) {
  const p1 = transformPoint(matrix, 0, 0)
  const p2 = transformPoint(matrix, 1, 0)
  const p3 = transformPoint(matrix, 0, 1)
  const p4 = transformPoint(matrix, 1, 1)
  const xs = [p1.x, p2.x, p3.x, p4.x]
  const ys = [p1.y, p2.y, p3.y, p4.y]
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  }
}

function isCandidateValid(candidate: PdfPhotoCandidate, opts: Required<PdfPhotoOptions>): boolean {
  const area = candidate.width * candidate.height
  if (area <= opts.minArea) return false

  const aspect = candidate.width / Math.max(candidate.height, 1)
  if (aspect < opts.minAspectRatio || aspect > opts.maxAspectRatio) return false

  const topLimit = candidate.pageHeight * opts.topRegionRatio
  if (candidate.y > topLimit) return false

  return true
}

function scoreCandidate(candidate: PdfPhotoCandidate, opts: Required<PdfPhotoOptions>): number {
  const aspect = candidate.width / Math.max(candidate.height, 1)
  const area = candidate.width * candidate.height
  const topLimit = candidate.pageHeight * opts.topRegionRatio
  const topScore = Math.max(0, 1 - candidate.y / Math.max(topLimit, 1))
  const aspectScore = 1 - Math.abs(1 - aspect)
  const areaScore = Math.min(area / 50000, 3)
  return topScore * 2 + aspectScore * 1.5 + areaScore
}

async function getImageObject(page: any, name: string): Promise<any> {
  return await new Promise((resolve) => {
    try {
      page.objs.get(name, (obj: any) => resolve(obj))
      const cached = page.objs.get(name)
      if (cached) resolve(cached)
    } catch {
      resolve(null)
    }
  })
}

async function extractCandidatesFromPage(page: any): Promise<PdfPhotoCandidate[]> {
  const viewport = page.getViewport({ scale: 1 })
  const opList = await page.getOperatorList()
  const candidates: PdfPhotoCandidate[] = []
  const stack: number[][] = []
  let ctm = [1, 0, 0, 1, 0, 0]

  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i]
    const args = opList.argsArray[i]

    if (fn === OPS.save) {
      stack.push(ctm.slice())
      continue
    }

    if (fn === OPS.restore) {
      ctm = stack.pop() ?? [1, 0, 0, 1, 0, 0]
      continue
    }

    if (fn === OPS.transform && Array.isArray(args) && args.length >= 6) {
      ctm = multiplyTransform(ctm, args as number[])
      continue
    }

    const imageName =
      fn === OPS.paintImageXObject ||
      fn === OPS.paintJpegXObject ||
      fn === OPS.paintInlineImageXObject ||
      fn === OPS.paintImageXObjectRepeat
        ? args?.[0]
        : null

    if (typeof imageName !== "string") continue

    const image = await getImageObject(page, imageName)
    const dataUrl = imageToDataUrl(image)
    if (!dataUrl) continue

    const bbox = bboxFromTransform(ctm)
    if (bbox.width <= 0 || bbox.height <= 0) continue

    candidates.push({
      dataUrl,
      width: bbox.width,
      height: bbox.height,
      x: bbox.x,
      y: bbox.y,
      pageWidth: viewport.width,
      pageHeight: viewport.height,
    })
  }

  return candidates
}

/**
 * 从 PDF 中提取最像证件照的图片。
 * 只保留宽高比 0.7~1.3、面积 > 10000px、位于页面顶部 30% 区域的图片；无符合项则返回空字符串。
 */
export async function extractResumePhoto(buffer: Buffer): Promise<string> {
  ensurePdfjsWorker()
  const doc = await getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    disableFontFace: true,
  }).promise

  const opts = DEFAULT_OPTIONS
  let best: { url: string; score: number } | null = null

  try {
    for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
      const page = await doc.getPage(pageNum)
      const candidates = await extractCandidatesFromPage(page)
      for (const candidate of candidates) {
        if (!isCandidateValid(candidate, opts)) continue
        const score = scoreCandidate(candidate, opts)
        if (!best || score > best.score) {
          best = { url: candidate.dataUrl, score }
        }
      }
    }
  } finally {
    await doc.destroy()
  }

  return best?.url ?? ""
}
