import "server-only"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"

// Service-role Supabase client for the trusted server action. Bypasses RLS —
// NEVER import this into a client component or expose the key to the browser.
// With the "no login" model, all DB access happens here; there is no
// cookie/session plumbing.
//
// Returns null when Supabase isn't configured, so the app can fall back to the
// stateless (no-cache) pipeline instead of crashing before the DB exists.

let cached: SupabaseClient | null | undefined

export function getServiceClient(): SupabaseClient | null {
  if (cached !== undefined) return cached

  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.warn("[supabase] SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — cache/budget disabled")
    cached = null
    return cached
  }

  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return cached
}

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY)
}
