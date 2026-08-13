import "server-only"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { Font } from "@react-pdf/renderer"
import { RESUME_FONT_FAMILY } from "@/lib/pdf/font-family"

export { RESUME_FONT_FAMILY }

let registered = false

function candidateFontPaths(): string[] {
  const home = os.homedir()
  const bundled = [
    path.join(process.cwd(), "public/fonts/NotoSansSC-Regular.woff"),
    path.join(process.cwd(), "public/fonts/NotoSansSC-Bold.woff"),
  ]

  if (process.platform === "darwin") {
    return [
      ...bundled,
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
      ...bundled,
      path.join(windir, "Fonts", "simhei.ttf"),
      path.join(windir, "Fonts", "msyh.ttf"),
      path.join(windir, "Fonts", "msyh.ttc"),
      path.join(windir, "Fonts", "simsun.ttc"),
      path.join(windir, "Fonts", "simkai.ttf"),
    ]
  }

  return [
    ...bundled,
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJKsc-Regular.otf",
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/truetype/wqy/wqy-microhei.ttc",
    "/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc",
    "/usr/share/fonts/truetype/droid/DroidSansFallbackFull.ttf",
  ]
}

export function resolveSystemCjkFontPath(): string {
  const found = candidateFontPaths().find((p) => {
    try {
      return fs.existsSync(p)
    } catch {
      return false
    }
  })

  if (!found) {
    throw new Error(
      "未找到可用的系统中文字体，请安装 Arial Unicode / 黑体 / Noto Sans CJK"
    )
  }

  return found
}

/** 幂等注册：导出 PDF 前调用一次 */
export function registerResumeFonts(): void {
  if (registered) return

  const src = resolveSystemCjkFontPath()
  const boldPath = path.join(
    process.cwd(),
    "public/fonts/NotoSansSC-Bold.woff"
  )
  const boldSrc = fs.existsSync(boldPath) ? boldPath : src

  Font.register({
    family: RESUME_FONT_FAMILY,
    fonts: [
      { src, fontWeight: "normal" },
      { src: boldSrc, fontWeight: "bold" },
    ],
  })

  // CJK 文本没有空格分词。若整段返回，React-PDF 会将其视为不可换行长词并溢出页面。
  // 汉字和标点按字符断行，英文术语与数字保持为完整 token，兼顾中文换行和术语可读性。
  Font.registerHyphenationCallback((word) =>
    word.match(/[\u4e00-\u9fff]|[A-Za-z0-9]+(?:[.+#/-][A-Za-z0-9]+)*|[^\s]/g) ?? [word]
  )

  registered = true
}
