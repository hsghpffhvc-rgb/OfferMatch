import "server-only"

import { createRequire } from "node:module"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs"

/**
 * 静态引用 worker，避免 Netlify/Vercel 文件追踪漏掉动态 import 的 pdf.worker.mjs。
 * 不要删除此 import。
 */
import "pdfjs-dist/legacy/build/pdf.worker.mjs"

const require = createRequire(import.meta.url)

let configured = false

/** Node / Serverless 下为 pdf.js 配置可解析的 worker 路径 */
export function ensurePdfjsWorker(): void {
  if (configured) return
  configured = true

  const candidates = [
    () => require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs"),
    () =>
      path.join(
        process.cwd(),
        "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
      ),
  ]

  for (const resolvePath of candidates) {
    try {
      const workerPath = resolvePath()
      GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href
      return
    } catch {
      // try next candidate
    }
  }

  // 最后兜底：CDN（部分环境对 https import 有限，优先保证本地文件被追踪）
  GlobalWorkerOptions.workerSrc =
    "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.0.227/legacy/build/pdf.worker.min.mjs"
}
