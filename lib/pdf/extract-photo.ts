import "server-only"

export interface PdfImageCandidate {
  dataUrl: string
  width: number
  height: number
  x: number
  y: number
  pageWidth: number
  pageHeight: number
}

export interface PhotoExtractionOptions {
  minAspectRatio?: number
  maxAspectRatio?: number
  minArea?: number
  topRegionRatio?: number
}

const DEFAULT_OPTIONS: Required<PhotoExtractionOptions> = {
  minAspectRatio: 0.7,
  maxAspectRatio: 1.3,
  minArea: 10000,
  topRegionRatio: 0.3,
}

function getImageSize(dataUrl: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      resolve({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height })
    }
    img.onerror = () => resolve(null)
    img.src = dataUrl
  })
}

function scoreCandidate(candidate: PdfImageCandidate, opts: Required<PhotoExtractionOptions>): number {
  const aspect = candidate.width / Math.max(candidate.height, 1)
  const area = candidate.width * candidate.height
  const topLimit = candidate.pageHeight * opts.topRegionRatio
  const inTopRegion = candidate.y <= topLimit

  if (area < opts.minArea) return -1
  if (aspect < opts.minAspectRatio || aspect > opts.maxAspectRatio) return -1
  if (!inTopRegion) return -1

  const aspectDistance = Math.abs(aspect - 1)
  const normalizedTop = Math.max(0, 1 - candidate.y / Math.max(topLimit, 1))
  const areaScore = Math.min(area / 50000, 2)

  return areaScore + normalizedTop * 2 - aspectDistance
}

/**
 * 选择最像证件照/头像的 PDF 嵌入图片。
 * 只接受顶部区域、接近正方形、面积足够大的图片；否则返回空字符串。
 */
export async function selectResumePhotoFromCandidates(
  candidates: PdfImageCandidate[],
  options?: PhotoExtractionOptions,
): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  let best: { url: string; score: number } | null = null

  for (const candidate of candidates) {
    const size = await getImageSize(candidate.dataUrl)
    if (!size) continue

    const enriched: PdfImageCandidate = {
      ...candidate,
      width: size.width || candidate.width,
      height: size.height || candidate.height,
    }

    const score = scoreCandidate(enriched, opts)
    if (score < 0) continue
    if (!best || score > best.score) {
      best = { url: candidate.dataUrl, score }
    }
  }

  return best?.url ?? ""
}
