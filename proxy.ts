import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// ---------------------------------------------------------------------------
// Content-Security-Policy
// 'unsafe-inline' and 'unsafe-eval' are required by Next.js App Router SSR.
// For a stricter policy, use nonce-based CSP (see Next.js docs on CSP).
// ---------------------------------------------------------------------------
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ")

// ---------------------------------------------------------------------------
// Allowed origins for same-origin enforcement
// Add your production domain to NEXT_PUBLIC_APP_URL in Vercel env vars.
// ---------------------------------------------------------------------------
function isAllowedOrigin(origin: string, host: string): boolean {
  if (origin === `https://${host}` || origin === `http://${host}`) return true
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  if (appUrl && origin === appUrl) return true
  // Allow localhost during development
  if (origin.startsWith("http://localhost:")) return true
  return false
}

export function proxy(request: NextRequest) {
  const { method, nextUrl } = request
  const host = request.headers.get("host") ?? ""
  const origin = request.headers.get("origin") ?? ""

  // Block cross-origin POST requests (protects server actions and API routes)
  if (method === "POST" && origin && !isAllowedOrigin(origin, host)) {
    return new NextResponse("Forbidden", { status: 403 })
  }

  const response = NextResponse.next()

  response.headers.set("Content-Security-Policy", CSP)
  response.headers.set("X-Frame-Options", "DENY")
  response.headers.set("X-Content-Type-Options", "nosniff")
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  )
  response.headers.set("X-DNS-Prefetch-Control", "off")

  void nextUrl // suppress unused warning
  return response
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
