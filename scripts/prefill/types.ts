// Output shape for the prefill catalog. Mirrors the `wines` table from the
// rebuild spec (AUDIT-AND-REBUILD.md §2.3) plus provenance fields so the
// Supabase loader (Phase 3.5) can upsert with full audit trail.
export interface CatalogWine {
  // ── identity ────────────────────────────────────────────────────────────
  canonicalKey: string // slug(producer)|slug(name)|vintage — matches wines.canonical_key
  name: string
  producer: string | null
  vintage: number | null // null = NV
  wineType: WineType
  region: string // canonical taxonomy key, or "Other"
  country: string | null

  // ── the data moat: real Swiss retail price, per 75cl bottle ──────────────
  marketPriceChf: number | null
  priceBasis: "single-bottle" | "derived-per-bottle" // how marketPriceChf was obtained
  bottleSizeClRef: number // the format the price was read from (75 ideal)

  // ── enrichment we get for free from the retailer ─────────────────────────
  criticScore: number | null // 80–100, median of /100 critics; null if none
  criticRatings: CriticRating[] // raw, for audit
  sommelierNote: string | null // short teaser (retailer copy)

  // ── provenance ───────────────────────────────────────────────────────────
  source: string // e.g. "gerstl"
  sourceUrl: string
  sourceSku: string | null
  subskription: boolean // en primeur / futures — not yet physically available
  scrapedAt: string // ISO
}

export interface CriticRating {
  author: string
  rating: string // raw, e.g. "96-98"
  of: number // scale, e.g. 100
}

export type WineType =
  | "Red"
  | "White"
  | "Rosé"
  | "Champagne"
  | "Sparkling"
  | "Dessert"
  | "Non-Alcoholic"

// A retailer adapter turns one product-page URL + its HTML into zero or one
// CatalogWine. Returns null when the page isn't a parseable single wine
// (gift boxes, tasting sets, out-of-taxonomy items).
export interface SourceAdapter {
  name: string
  origin: string // e.g. "https://www.gerstl.ch"
  sitemapUrl: string
  // Filter sitemap URLs down to product pages worth fetching.
  isProductUrl(url: string): boolean
  // Parse a fetched product page.
  parse(url: string, html: string): CatalogWine | null
}
