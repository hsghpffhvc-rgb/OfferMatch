import { TopNav } from "@/components/top-nav"
import { HistoryDetail } from "@/components/history-detail"

interface HistoryDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function HistoryDetailPage({ params }: HistoryDetailPageProps) {
  const { id } = await params

  return (
    <div className="min-h-screen bg-mesh">
      <TopNav />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <HistoryDetail id={id} />
      </main>
    </div>
  )
}
