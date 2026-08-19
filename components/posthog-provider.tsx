"use client"

import posthog from "posthog-js"
import { PostHogProvider as PHProvider } from "posthog-js/react"
import { usePathname, useSearchParams } from "next/navigation"
import { Suspense, useEffect } from "react"

import { isPostHogEnabled } from "@/lib/posthog-env"

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
 * PostHog React 上下文 + SPA pageview。
 * SDK 初始化在根目录 instrumentation-client.ts（Next.js 16 推荐方式）。
 */
export function PostHogProvider({ children }: { children: React.ReactNode }) {
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
