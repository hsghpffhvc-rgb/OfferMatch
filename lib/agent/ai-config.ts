import "server-only"

/** 缺少密钥等配置问题时不应静默降级到示例数据 */
export class AiConfigError extends Error {
  readonly code = "AI_CONFIG_ERROR" as const

  constructor(message: string) {
    super(message)
    this.name = "AiConfigError"
  }
}

export function assertAiConfigured(): void {
  const key = process.env.OPENAI_API_KEY?.trim()
  if (!key || key === "sk-your-api-key-here") {
    throw new AiConfigError(
      "服务端未配置有效的 OPENAI_API_KEY。请在 Netlify → Site configuration → Environment variables 中设置 OPENAI_API_KEY、OPENAI_BASE_URL、OPENAI_MODEL 后重新部署。",
    )
  }
}

export function isAiConfigured(): boolean {
  const key = process.env.OPENAI_API_KEY?.trim()
  return Boolean(key && key !== "sk-your-api-key-here")
}

export function isAiConfigError(error: unknown): boolean {
  if (error instanceof AiConfigError) return true
  const message = error instanceof Error ? error.message : String(error)
  return /OPENAI_API_KEY|未配置有效|AI_CONFIG_ERROR|invalid.?api.?key|Incorrect API key|401|Unauthorized/i.test(
    message,
  )
}
