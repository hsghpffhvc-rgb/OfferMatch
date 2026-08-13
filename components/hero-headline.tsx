"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

/** 主题文案：前两字 / 换行后前两字带渐变色 */
const LINE_1 = [
  { char: "设", accent: true },
  { char: "想", accent: true },
  { char: "不", accent: false },
  { char: "曾", accent: false },
  { char: "设", accent: false },
  { char: "想", accent: false },
] as const

const LINE_2 = [
  { char: "突", accent: true },
  { char: "破", accent: true },
  { char: "不", accent: false },
  { char: "曾", accent: false },
  { char: "突", accent: false },
  { char: "破", accent: false },
] as const

const TITLE_CHARS = [...LINE_1, ...LINE_2]
const CHAR_INTERVAL_MS = 120
const SUBTITLE_DELAY_MS = 1000
const SUBTITLE_FADE_MS = 1000

/**
 * 首页主题打字机 + 副标题淡入
 * - 逐字 120ms，末尾竖线闪烁，打完后光标消失
 * - 主题全部出现后再等 1s，副标题淡入（1s ease-out）
 */
export function HeroHeadline() {
  const [visibleCount, setVisibleCount] = useState(0)
  const [titleDone, setTitleDone] = useState(false)
  const [subtitleVisible, setSubtitleVisible] = useState(false)

  useEffect(() => {
    if (visibleCount >= TITLE_CHARS.length) {
      setTitleDone(true)
      // 打完主题后等待 1s 再淡入副标题
      const fadeTimer = window.setTimeout(() => setSubtitleVisible(true), SUBTITLE_DELAY_MS)
      return () => window.clearTimeout(fadeTimer)
    }

    const timer = window.setTimeout(() => {
      setVisibleCount((n) => n + 1)
    }, CHAR_INTERVAL_MS)

    return () => window.clearTimeout(timer)
  }, [visibleCount])

  const renderLine = (chars: typeof LINE_1 | typeof LINE_2, offset: number) =>
    chars.map((item, i) => {
      const globalIndex = offset + i
      if (globalIndex >= visibleCount) return null
      return (
        <span
          key={`${offset}-${i}`}
          className={item.accent ? "text-gradient-purple" : undefined}
        >
          {item.char}
        </span>
      )
    })

  const showCursor = !titleDone
  // 光标跟在当前已打出的最后一个字后面；尚未打字时显示在行首
  const cursorAfterLine1 = visibleCount <= LINE_1.length
  const cursorAfterLine2 = visibleCount > LINE_1.length

  return (
    <>
      <h1
        className="mt-6 text-balance text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl"
        aria-label="设想不曾设想 突破不曾突破"
      >
        <span className="inline">
          {renderLine(LINE_1, 0)}
          {showCursor && cursorAfterLine1 && (
            <span className="hero-type-cursor" aria-hidden="true">
              |
            </span>
          )}
        </span>
        {/* 小屏同行续打；sm 及以上在「设想」行后换行 */}
        <br className="hidden sm:block" />
        <span className="inline">
          {renderLine(LINE_2, LINE_1.length)}
          {showCursor && cursorAfterLine2 && (
            <span className="hero-type-cursor" aria-hidden="true">
              |
            </span>
          )}
        </span>
      </h1>

      <p
        className={cn(
          "mt-4 max-w-2xl text-pretty text-sm font-normal leading-relaxed text-muted-foreground sm:text-base",
          "transition-opacity ease-out",
          subtitleVisible ? "opacity-100" : "opacity-0",
        )}
        style={{ transitionDuration: `${SUBTITLE_FADE_MS}ms` }}
      >
        不只做更好的简历优化工具，而成为
        <span className="text-muted-foreground">“更懂你的AI求职Agent”</span>
      </p>
    </>
  )
}
