import { isAiConfigured } from "@/lib/agent/ai-config"
import { getModel } from "@/lib/openai"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** 部署健康检查：只返回是否配置了 AI，不泄露密钥 */
export async function GET() {
  const aiConfigured = isAiConfigured()
  return Response.json({
    ok: true,
    aiConfigured,
    model: aiConfigured ? getModel() : null,
    baseUrlConfigured: Boolean(process.env.OPENAI_BASE_URL?.trim()),
  })
}
