import type { StreamEvent } from "@/lib/agent/types"

export function encodeSSE(event: StreamEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`
}

export function createSSEStream(
  handler: (emit: (event: StreamEvent) => void) => Promise<void>,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()

  return new ReadableStream({
    async start(controller) {
      const emit = (event: StreamEvent) => {
        controller.enqueue(encoder.encode(encodeSSE(event)))
      }

      try {
        await handler(emit)
      } catch (error) {
        const message = error instanceof Error ? error.message : "未知错误"
        controller.enqueue(
          encoder.encode(encodeSSE({ type: "error", message })),
        )
      } finally {
        controller.close()
      }
    },
  })
}
