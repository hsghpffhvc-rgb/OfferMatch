"use client"

import posthog from "posthog-js"

const VISITOR_KEY = "offermatch:visitor-id:v1"

function createVisitorId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `v-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function getAnonymousVisitorId(): string {
  try {
    const existing = localStorage.getItem(VISITOR_KEY)
    if (existing) return existing
    const next = createVisitorId()
    localStorage.setItem(VISITOR_KEY, next)
    return next
  } catch {
    return createVisitorId()
  }
}

export function getPostHogDistinctId(): string | null {
  try {
    return posthog.get_distinct_id?.() ?? null
  } catch {
    return null
  }
}
