import { redirect } from "next/navigation"
import { setAdminSession, validateAdminPassword } from "@/lib/admin-auth"

export const runtime = "nodejs"

export async function POST(request: Request) {
  const formData = await request.formData()
  const password = String(formData.get("password") ?? "")
  if (!validateAdminPassword(password)) {
    redirect("/admin?error=1")
  }

  await setAdminSession()
  redirect("/admin")
}
