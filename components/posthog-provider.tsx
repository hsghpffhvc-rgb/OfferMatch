"use client"

import posthog from "posthog-js"
import { PostHogProvider as PHProvider } from "posthog-js/react"
import { usePathname, useSearchParams } from "next/navigation"
import { Suspense, useEffect } from "react"

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY
const POSTHOG_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com"

let posthogInitialized = false

function isPostHogEnabled(): boolean {
  return Boolean(POSTHOG_KEY)
}

/** App Router 手动上报 pageview（SPA 路由变化） */
function PostHogPageView() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!isPostHogEnabled() || !pathname) return
    const query = searchParams?.toString()
    const url = query ? `${pathname}?${query}` : pathname
    posthog.capture("$pageview", { $current_url: url })
  }, [pathname, searchParams])

  return null
}

/**
 * 匿名访问数据：无需注册。
 * PostHog 自动生成 distinct_id 并写入 cookie，可在控制台查看访客与漏斗。
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!isPostHogEnabled()) return
    if (posthogInitialized) return
    posthogInitialized = true

    posthog.init(POSTHOG_KEY!, {
      api_host: POSTHOG_HOST,
      // 匿名访客也建 Person，便于在 PostHog 查看「用户」
      person_profiles: "always",
      capture_pageview: false, // 由 PostHogPageView 手动捕获
      capture_pageleave: true,
      persistence: "localStorage+cookie",
      loaded: (client) => {
        if (process.env.NODE_ENV === "development") {
          client.debug()
        }
      },
    })
  }, [])

  if (!isPostHogEnabled()) {
    return <>{children}</>
  }

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </PHProvider>
  )
}
