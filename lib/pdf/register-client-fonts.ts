import { Font } from "@react-pdf/renderer"
import { RESUME_FONT_FAMILY } from "@/lib/pdf/font-family"

let registered = false

/** 客户端预览：注册 Noto Sans SC（public/fonts） */
export function registerClientResumeFonts(): void {
  if (registered || typeof window === "undefined") return

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

  Font.registerHyphenationCallback((word) => [word])
  registered = true
}
