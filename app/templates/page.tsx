import Link from "next/link"
import { Suspense } from "react"
import { ArrowLeft } from "lucide-react"
import { TopNav } from "@/components/top-nav"
import { TemplatesPlayground } from "@/components/templates-playground"

export default function TemplatesPage() {
  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-start gap-4">
          <Link
            href="/"
            className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:border-[#A18AFF]/50 hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            返回
          </Link>
          <div className="min-w-0">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              简历模板预览
            </h1>
          </div>
        </div>
        <Suspense
          fallback={
            <p className="text-sm text-muted-foreground">加载模板预览…</p>
          }
        >
          <TemplatesPlayground />
        </Suspense>
      </main>
    </div>
  )
}
