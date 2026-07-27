// Hand-written to match supabase/migrations/0001_init.sql so the app typechecks
// before a project exists. Once the project is provisioned, regenerate with the
// Supabase MCP `generate_typescript_types` tool (or `supabase gen types`) and
// replace this file.

import type { WineType } from "@/lib/scoring"

export interface WineRow {
  id: string
  canonical_key: string
  name: string
  producer: string | null
  vintage: number | null
  wine_type: WineType
  region: string
  country: string | null
  market_price_chf: number | null
  price_confidence: "estimated" | "verified" | null
  critic_score: number | null
  food_pairings: string[]
  sommelier_note: string | null
  enriched_at: string | null
  enrichment_model: string | null
  created_at: string
}

export type WineInsert = Omit<WineRow, "id" | "created_at"> & {
  id?: string
  created_at?: string
}

export interface ScanRow {
  id: string
  content_hash: string
  source_type: "file" | "url" | null
  source_ref: string | null
  client_ip: string | null
  wine_count: number | null
  created_at: string
}

export interface ScanWineRow {
  scan_id: string
  wine_id: string
  restaurant_price_chf: number
  raw_line: string | null
}

export interface ApiUsageInsert {
  model: string
  step: "extraction" | "enrichment"
  input_tokens: number
  output_tokens: number
  cache_read_tokens?: number
  cache_write_tokens?: number
  estimated_cost_chf: number
  client_ip?: string | null
}
