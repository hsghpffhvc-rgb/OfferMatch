import { Font } from "@react-pdf/renderer"
import { RESUME_FONT_FAMILY } from "@/lib/pdf/font-family"

let registered = false
let registerPromise: Promise<void> | null = null

const FONT_CANDIDATES = [
  {
    regular: "/fonts/NotoSansSC-Regular.ttf",
    bold: "/fonts/NotoSansSC-Bold.ttf",
  },
  {
    regular: "/fonts/NotoSansSC-Regular.woff",
    bold: "/fonts/NotoSansSC-Bold.woff",
  },
] as const

function hyphenate(word: string): string[] {
  return (
    word.match(
      /[\u4e00-\u9fff]|[A-Za-z0-9]+(?:[.+#/-][A-Za-z0-9]+)*|[^\s]/g
    ) ?? [word]
  )
}

async function resolveReachableFonts(): Promise<{
  regular: string
  bold: string
}> {
  for (const pair of FONT_CANDIDATES) {
    const results = await Promise.all(
      [pair.regular, pair.bold].map(async (url) => {
        const res = await fetch(url, { method: "GET", cache: "force-cache" })
        return res.ok ? url : null
      })
    )
    if (results[0]) {
      return { regular: results[0], bold: results[1] ?? results[0] }
    }
  }
  throw new Error("字体加载失败：未找到可用的 NotoSansSC 字体文件")
}

/** 客户端预览：注册 Noto Sans SC，优先 TTF */
export async function registerClientResumeFonts(): Promise<void> {
  if (registered || typeof window === "undefined") return
  if (registerPromise) return registerPromise

  registerPromise = (async () => {
    const { regular, bold } = await resolveReachableFonts()

    Font.register({
      family: RESUME_FONT_FAMILY,
      fonts: [
        { src: regular, fontWeight: "normal" },
        { src: bold, fontWeight: "bold" },
      ],
    })

    Font.registerHyphenationCallback(hyphenate)
    registered = true
  })().catch((err) => {
    registerPromise = null
    throw err
  })

  return registerPromise
}
