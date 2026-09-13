import "server-only"

import { createHmac, timingSafeEqual } from "crypto"
import { cookies } from "next/headers"

const COOKIE_NAME = "offermatch_admin"
const ONE_WEEK_SECONDS = 60 * 60 * 24 * 7

function getSecret(): string {
  return process.env.ADMIN_PASSWORD || process.env.SUPABASE_SERVICE_ROLE_KEY || "dev-secret"
}

function sign(value: string): string {
  return createHmac("sha256", getSecret()).update(value).digest("hex")
}

function verifyToken(token: string | undefined): boolean {
  if (!token) return false
  const [value, signature] = token.split(".")
  if (!value || !signature) return false
  const expected = sign(value)
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  } catch {
    return false
  }
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const store = await cookies()
  return verifyToken(store.get(COOKIE_NAME)?.value)
}

export async function setAdminSession(): Promise<void> {
  const store = await cookies()
  const value = Date.now().toString(36)
  store.set(COOKIE_NAME, `${value}.${sign(value)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ONE_WEEK_SECONDS,
    path: "/",
  })
}

export async function clearAdminSession(): Promise<void> {
  const store = await cookies()
  store.delete(COOKIE_NAME)
}

export function validateAdminPassword(password: string): boolean {
  const expected = process.env.ADMIN_PASSWORD
  return Boolean(expected && password === expected)
}
