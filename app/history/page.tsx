import { TopNav } from "@/components/top-nav"
import { HistoryList } from "@/components/history-list"

export default function HistoryPage() {
  return (
    <div className="min-h-screen bg-mesh">
      <TopNav />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
        <HistoryList />
      </main>
    </div>
  )
}
