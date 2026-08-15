import { Font } from "@react-pdf/renderer"
import { RESUME_FONT_FAMILY } from "@/lib/pdf/font-family"

let registered = false
let registerPromise: Promise<void> | null = null

function hyphenate(word: string): string[] {
  return (
    word.match(
      /[\u4e00-\u9fff]|[A-Za-z0-9]+(?:[.+#/-][A-Za-z0-9]+)*|[^\s]/g
    ) ?? [word]
  )
}

/** 等待字体文件可访问，避免首次渲染时字体未就绪 */
async function assertFontsReachable(): Promise<void> {
  const urls = [
    "/fonts/NotoSansSC-Regular.woff",
    "/fonts/NotoSansSC-Bold.woff",
  ]
  await Promise.all(
    urls.map(async (url) => {
      const res = await fetch(url, { method: "GET", cache: "force-cache" })
      if (!res.ok) {
        throw new Error(`字体加载失败（${url} → ${res.status}）`)
      }
    })
  )
}

/** 客户端预览：注册 Noto Sans SC（public/fonts），幂等 */
export async function registerClientResumeFonts(): Promise<void> {
  if (registered || typeof window === "undefined") return
  if (registerPromise) return registerPromise

  registerPromise = (async () => {
    await assertFontsReachable()

    Font.register({
      family: RESUME_FONT_FAMILY,
      fonts: [
        {
          src: "/fonts/NotoSansSC-Regular.woff",
          fontWeight: "normal",
        },
        {
          src: "/fonts/NotoSansSC-Bold.woff",
          fontWeight: "bold",
        },
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
