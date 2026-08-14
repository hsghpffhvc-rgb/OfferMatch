import "server-only"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { Font } from "@react-pdf/renderer"
import { RESUME_FONT_FAMILY } from "@/lib/pdf/font-family"

export { RESUME_FONT_FAMILY }

let registered = false

const BUNDLED_REGULAR = "public/fonts/NotoSansSC-Regular.woff"
const BUNDLED_BOLD = "public/fonts/NotoSansSC-Bold.woff"

function bundledFontPath(relativePath: string): string {
  return path.join(process.cwd(), relativePath)
}

function fileExists(filePath: string): boolean {
  try {
    return fs.existsSync(filePath)
  } catch {
    return false
  }
}

function systemFallbackFonts(): string[] {
  const home = os.homedir()

  if (process.platform === "darwin") {
    return [
      "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
      "/Library/Fonts/Arial Unicode.ttf",
      path.join(home, "Library/Fonts/Arial Unicode.ttf"),
      "/System/Library/Fonts/STHeiti Light.ttc",
      "/System/Library/Fonts/Hiragino Sans GB.ttc",
    ]
  }

  if (process.platform === "win32") {
    const windir = process.env.WINDIR ?? "C:\\Windows"
    return [
      path.join(windir, "Fonts", "simhei.ttf"),
      path.join(windir, "Fonts", "msyh.ttf"),
      path.join(windir, "Fonts", "msyh.ttc"),
      path.join(windir, "Fonts", "simsun.ttc"),
      path.join(windir, "Fonts", "simkai.ttf"),
    ]
  }

  return [
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJKsc-Regular.otf",
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc",
    "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
    "/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf",
  ]
}

/** 优先使用随仓库打包的 Noto Sans SC，避免 Vercel 无系统中文字体 */
export function resolveBundledFontPaths(): { regular: string; bold: string } {
  const regularBundled = bundledFontPath(BUNDLED_REGULAR)
  const boldBundled = bundledFontPath(BUNDLED_BOLD)

  if (fileExists(regularBundled)) {
    return {
      regular: regularBundled,
      bold: fileExists(boldBundled) ? boldBundled : regularBundled,
    }
  }

  const fallback = systemFallbackFonts().find(fileExists)
  if (!fallback) {
    throw new Error(
      "未找到中文字体：请确认 public/fonts/NotoSansSC-*.woff 已随部署打包（Vercel 需 outputFileTracingIncludes）"
    )
  }

  return { regular: fallback, bold: fallback }
}

/** @deprecated 使用 resolveBundledFontPaths；保留供旧调用兼容 */
export function resolveSystemCjkFontPath(): string {
  return resolveBundledFontPaths().regular
}

/** 幂等注册：导出 PDF 前调用一次 */
export function registerResumeFonts(): void {
  if (registered) return

  const { regular, bold } = resolveBundledFontPaths()

  Font.register({
    family: RESUME_FONT_FAMILY,
    fonts: [
      { src: regular, fontWeight: "normal" },
      { src: bold, fontWeight: "bold" },
    ],
  })

  // CJK 文本没有空格分词。若整段返回，React-PDF 会将其视为不可换行长词并溢出页面。
  // 汉字和标点按字符断行，英文术语与数字保持为完整 token，兼顾中文换行和术语可读性。
  Font.registerHyphenationCallback(
    (word) =>
      word.match(
        /[\u4e00-\u9fff]|[A-Za-z0-9]+(?:[.+#/-][A-Za-z0-9]+)*|[^\s]/g
      ) ?? [word]
  )

  registered = true
}
