import OpenAI from "openai"

let client: OpenAI | null = null
let clientKey: string | null = null

export function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY 未配置，请在 .env.local 中设置")
  }

  const fingerprint = `${process.env.OPENAI_API_KEY}|${process.env.OPENAI_BASE_URL ?? ""}`
  if (!client || clientKey !== fingerprint) {
    client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL || undefined,
    })
    clientKey = fingerprint
  }

  return client
}

export function getModel(): string {
  return process.env.OPENAI_MODEL || "qwen3.8-max"
}

/** 通义千问等模型是否需要关闭思考链，避免干扰 JSON 解析 */
export function shouldDisableThinking(): boolean {
  const model = getModel().toLowerCase()
  return model.includes("qwen") || process.env.DISABLE_THINKING === "true"
}
