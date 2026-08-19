import posthog from "posthog-js"

import {
  getPostHogApiHost,
  getPostHogKey,
  POSTHOG_UI_HOST,
} from "@/lib/posthog-env"

const key = getPostHogKey()

if (key) {
  posthog.init(key, {
    api_host: getPostHogApiHost(),
    ui_host: POSTHOG_UI_HOST,
    defaults: "2026-05-30",
    // 匿名访客也建 Person，便于在 PostHog 查看「用户」
    person_profiles: "always",
    capture_pageview: false, // 由 PostHogPageView 手动捕获 SPA 路由
    capture_pageleave: true,
    persistence: "localStorage+cookie",
    loaded: (client) => {
      if (process.env.NODE_ENV === "development") {
        client.debug()
      }
    },
  })
}
