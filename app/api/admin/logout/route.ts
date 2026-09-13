import { redirect } from "next/navigation"
import { clearAdminSession } from "@/lib/admin-auth"

export const runtime = "nodejs"

export async function POST() {
  await clearAdminSession()
  redirect("/admin")
}
