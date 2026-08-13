/**
 * 离线渲染三模板 PDF，并导出首页 PNG 供视觉验收。
 * 用法: node scripts/render-template-previews.mjs
 */
import { createElement } from "react"
import { createRequire, register } from "node:module"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, "..")
const outDir = path.join(root, "tmp", "template-previews")

// 简易 TS / path-alias 加载（仅本脚本用）
register("./ts-hook.mjs", import.meta.url)

const require = createRequire(import.meta.url)
const { renderToBuffer, Font } = require("@react-pdf/renderer")
const { createCanvas } = require("@napi-rs/canvas")

const fontRegular = path.join(root, "public/fonts/NotoSansSC-Regular.woff")
const fontBold = path.join(root, "public/fonts/NotoSansSC-Bold.woff")

// 与 lib/pdf/font-family.ts 的 RESUME_FONT_FAMILY 保持一致
Font.register({
  family: "ResumeSans",
  fonts: [
    { src: fontRegular, fontWeight: "normal" },
    { src: fs.existsSync(fontBold) ? fontBold : fontRegular, fontWeight: "bold" },
  ],
})
Font.registerHyphenationCallback((word) => [word])

const { getTemplate } = await import(
  pathToFileURL(path.join(root, "lib/pdf/templates/index.ts")).href
)
const {
  createFullSampleResume,
  createSparseSampleResume,
} = await import(pathToFileURL(path.join(root, "lib/pdf/sample-data.ts")).href)

const templates = ["minimal", "business", "creative"]
const datasets = [
  { id: "full", factory: createFullSampleResume },
  { id: "sparse", factory: createSparseSampleResume },
]

fs.mkdirSync(outDir, { recursive: true })

async function pdfToPng(pdfBuffer, pngPath) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs")
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(pdfBuffer),
    useSystemFonts: true,
  })
  const pdf = await loadingTask.promise
  const page = await pdf.getPage(1)
  const viewport = page.getViewport({ scale: 2 })
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
  const ctx = canvas.getContext("2d")
  await page.render({
    canvasContext: ctx,
    viewport,
    canvas,
  }).promise
  fs.writeFileSync(pngPath, canvas.toBuffer("image/png"))
  if (typeof pdf.destroy === "function") await pdf.destroy()
  else if (typeof pdf.cleanup === "function") await pdf.cleanup()
}

const results = []

for (const dataset of datasets) {
  for (const template of templates) {
    const resume = dataset.factory(template)
    const Template = getTemplate(template)
    const element = createElement(Template, { resume })
    const buffer = await renderToBuffer(element)
    const base = `${dataset.id}-${template}`
    const pdfPath = path.join(outDir, `${base}.pdf`)
    const pngPath = path.join(outDir, `${base}.png`)
    fs.writeFileSync(pdfPath, buffer)
    await pdfToPng(buffer, pngPath)
    results.push({
      dataset: dataset.id,
      template,
      pdf: pdfPath,
      png: pngPath,
      bytes: buffer.length,
      hasPhoto: Boolean(resume.basics.photo),
      sections: resume.sections.map((s) => s.type),
    })
    console.log(`✓ ${base}  (${buffer.length} bytes)`)
  }
}

fs.writeFileSync(
  path.join(outDir, "manifest.json"),
  JSON.stringify(results, null, 2)
)
console.log(`\nDone → ${outDir}`)
