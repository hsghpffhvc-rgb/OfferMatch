import "server-only"

import { GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs"
import { PDFParse } from "pdf-parse"
import { getData } from "pdf-parse/worker"

let ready = false

/**
 * Netlify / serverless 下 node_modules 里的 pdf.worker.mjs 常未被打包进函数，
 * 导致 “Setting up fake worker failed: Cannot find module .../pdf.worker.mjs”。
 *
 * pdf-parse/worker 的 getData() 返回内嵌的 data:text/javascript;base64 worker，
 * 直接设为 workerSrc，不依赖运行时文件系统路径。
 */
export function ensurePdfjsWorker(): void {
  if (ready && GlobalWorkerOptions.workerSrc) return

  const workerSrc = getData()
  GlobalWorkerOptions.workerSrc = workerSrc
  PDFParse.setWorker(workerSrc)
  ready = true
}
