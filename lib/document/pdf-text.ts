import "server-only"

import { PDFParse } from "pdf-parse"

/** 使用 pdf-parse v2 API 从 PDF 提取纯文本 */
export async function extractPdfText(buffer: Buffer): Promise<string> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) })

  try {
    const result = await parser.getText()
    return result.text.replace(/\r\n/g, "\n").trim()
  } finally {
    await parser.destroy()
  }
}
