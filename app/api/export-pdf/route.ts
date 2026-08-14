import { createElement } from "react"
import { NextRequest, NextResponse } from "next/server"
import { renderToBuffer } from "@react-pdf/renderer"
import { registerResumeFonts } from "@/lib/pdf/fonts"
import { getTemplate } from "@/lib/pdf/templates"
import type { ResumeData } from "@/lib/pdf/types"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const resumeData = body as ResumeData

    if (!resumeData?.metadata?.template) {
      return NextResponse.json({ error: "缺少 template 参数" }, { status: 400 })
    }

    let Template
    try {
      Template = getTemplate(resumeData.metadata.template)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "无效的模板名"
      return NextResponse.json({ error: message }, { status: 400 })
    }

    registerResumeFonts()

    // 使用 buffer 而非 stream，避免 serverless 上流式响应被中途断开
    const pdfBuffer = await renderToBuffer(
      createElement(Template, { resume: resumeData })
    )

    const rawName = resumeData.basics?.name?.trim()
    const candidateName =
      rawName && !["求职者", "name"].includes(rawName.toLowerCase())
        ? rawName
        : "Name"
    const jobTitle = resumeData.basics?.title?.trim() || "岗位名称"
    const fileName = `${candidateName}-${jobTitle}.pdf`.replace(
      /[\\/:*?"<>|]/g,
      "-"
    )

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(pdfBuffer.byteLength),
        "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    console.error("PDF 导出失败:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "导出失败" },
      { status: 500 }
    )
  }
}
