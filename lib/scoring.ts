export type FoodPairing = "Chicken" | "Beef" | "Fish" | "Vegetarian"
export type WineRegion = "Bordeaux" | "Burgundy" | "Tuscany" | "Napa" | "Other"
export type MarkupColor = "green" | "amber" | "red"

export interface RawWine {
  name: string
  producer: string
  vintage: number | null
  region: WineRegion
  restaurantPrice: number
  marketPrice: number
  criticScore: number
  foodPairings: FoodPairing[]
  sommelierNote: string
  currency?: string
}

export interface ScoredWine extends RawWine {
  id: string
  currency: string
  markupFactor: number
  totalValueScore: number
  markupColor: MarkupColor
}

export interface ProcessResult {
  success: boolean
  wines?: ScoredWine[]
  currency?: string
  error?: string
}

export function scoreWine(wine: RawWine, index: number): ScoredWine {
  const markupFactor =
    Math.round((wine.restaurantPrice / wine.marketPrice) * 10) / 10

  // Markup component: ideal ≤2.5×; penalise above 3.5×; floor at 0
  const markupComponent = Math.max(0, Math.min(40, (5 - markupFactor) * 10))
  // Critic component: raw score × 0.6 (100pt wine → 60pts max)
  const criticComponent = wine.criticScore * 0.6
  const totalValueScore = Math.round(criticComponent + markupComponent)

  // Updated thresholds: green ≤2.5×, amber 2.5–3.5×, red >3.5×
  const markupColor: MarkupColor =
    markupFactor <= 2.5 ? "green" : markupFactor <= 3.5 ? "amber" : "red"

  return {
    ...wine,
    id: `wine-${index}`,
    currency: wine.currency ?? "CHF",
    markupFactor,
    totalValueScore,
    markupColor,
  }
}

export function scoreAndRankWines(wines: RawWine[]): ScoredWine[] {
  return wines
    .map(scoreWine)
    .sort((a, b) => b.totalValueScore - a.totalValueScore)
}
