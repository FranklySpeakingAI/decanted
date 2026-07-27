export type WineType =
  | "Red"
  | "White"
  | "Rosé"
  | "Champagne"
  | "Sparkling"
  | "Dessert"
  | "Non-Alcoholic"

export type FoodPairing = "Red Meat" | "White Meat" | "Game" | "Fish" | "Vegetarian"

// Canonical region keys. Switzerland-only expansion (rebuild §2.5) adds Ticino,
// Graubünden, Zürich, Schaffhausen, Thurgau, Aargau alongside the originals.
export type WineRegion =
  | "Bordeaux" | "Burgundy" | "Champagne" | "Rhône" | "Alsace" | "Loire"
  | "Languedoc" | "Provence" | "Jura" | "Beaujolais" | "Southwest France"
  | "Tuscany" | "Piedmont" | "Veneto" | "Sicily"
  | "Rioja" | "Ribera del Duero" | "Priorat"
  | "Germany" | "Austria"
  | "Swiss — Vaud" | "Swiss — Valais" | "Swiss — Geneva" | "Swiss — Neuchâtel"
  | "Swiss — Ticino" | "Swiss — Graubünden" | "Swiss — Zürich"
  | "Swiss — Schaffhausen" | "Swiss — Thurgau" | "Swiss — Aargau"
  | "Napa Valley" | "Sonoma" | "Argentina" | "Chile"
  | "Australia" | "New Zealand" | "South Africa"
  | "Other"

export type MarkupColor = "green" | "amber" | "red"

// Switzerland-only: currency is always CHF.
export const CURRENCY = "CHF" as const

export interface RawWine {
  name: string
  producer: string | null
  vintage: number | null
  type?: WineType
  region: WineRegion
  restaurantPrice: number
  // null = no market data (never a fabricated default — rebuild §2.4)
  marketPrice: number | null
  criticScore: number | null
  foodPairings: FoodPairing[]
  sommelierNote: string | null
  priceConfidence?: "estimated" | "verified" | null
}

export interface ScoredWine extends RawWine {
  id: string
  type: WineType
  currency: string
  // All null when marketPrice is unknown — the UI shows a "no market data" state.
  markupFactor: number | null
  totalValueScore: number | null
  markupColor: MarkupColor | null
}

export interface ProcessResult {
  success: boolean
  wines?: ScoredWine[]
  currency?: string
  error?: string
  // Cache telemetry (rebuild §2.7 "DB-hit-rate indicator").
  meta?: {
    fromCache: boolean          // whole scan served from the scans cache
    dbHits: number              // wines resolved from the catalog (free enrichment)
    enriched: number            // wines newly enriched this scan
    total: number
  }
}

// Score a wine. NO fabricated defaults: if there's no market price, markup and
// value score are null and the UI renders "no market data".
export function scoreWine(wine: RawWine, index: number): ScoredWine {
  const base: ScoredWine = {
    ...wine,
    id: `wine-${index}`,
    type: wine.type ?? "Red",
    currency: CURRENCY,
    markupFactor: null,
    totalValueScore: null,
    markupColor: null,
  }

  if (wine.marketPrice == null || wine.marketPrice <= 0) return base

  const markupFactor = Math.round((wine.restaurantPrice / wine.marketPrice) * 10) / 10
  // Markup component: ideal ≤2.5×; penalise above 3.5×; floor at 0.
  const markupComponent = Math.max(0, Math.min(40, (5 - markupFactor) * 10))
  const markupColor: MarkupColor =
    markupFactor <= 2.5 ? "green" : markupFactor <= 3.5 ? "amber" : "red"

  // Value score needs a critic score too; without one, only markup is known —
  // leave totalValueScore null rather than inventing an 85.
  const totalValueScore =
    wine.criticScore != null ? Math.round(wine.criticScore * 0.6 + markupComponent) : null

  return { ...base, markupFactor, markupColor, totalValueScore }
}

// Rank: scored wines first (by value), then wines with no market data last.
export function scoreAndRankWines(wines: RawWine[]): ScoredWine[] {
  return wines
    .map(scoreWine)
    .sort((a, b) => {
      if (a.totalValueScore == null && b.totalValueScore == null) return 0
      if (a.totalValueScore == null) return 1
      if (b.totalValueScore == null) return -1
      return b.totalValueScore - a.totalValueScore
    })
}
