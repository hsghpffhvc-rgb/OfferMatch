/** PostHog 反向代理路径（见 next.config.mjs rewrites） */
export const POSTHOG_PROXY_PATH = "/ingest"

export const POSTHOG_UI_HOST = "https://us.posthog.com"

/** 官方文档变量名 + 项目历史别名 */
export function getPostHogKey(): string | undefined {
  return (
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN ||
    process.env.NEXT_PUBLIC_POSTHOG_KEY ||
    undefined
  )
}

export function isPostHogEnabled(): boolean {
  return Boolean(getPostHogKey())
}

/** SDK 上报地址：走本站 /ingest 反向代理，降低被广告拦截器拦截的概率 */
export function getPostHogApiHost(): string {
  return POSTHOG_PROXY_PATH
}

/** next.config rewrites 实际转发到的 PostHog 区域 */
export function getPostHogRemoteHost(): string {
  return process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com"
}
