export type WineType =
  | "Red"
  | "White"
  | "Rosé"
  | "Champagne"
  | "Sparkling"
  | "Dessert"
  | "Non-Alcoholic"

export type FoodPairing = "Red Meat" | "White Meat" | "Game" | "Fish" | "Vegetarian"

// All canonical region keys the LLM maps to (matches WINE_REGIONS in mockLLM.ts)
export type WineRegion =
  // France
  | "Bordeaux" | "Burgundy" | "Champagne" | "Rhône" | "Alsace" | "Loire"
  | "Languedoc" | "Provence" | "Jura" | "Beaujolais" | "Southwest France"
  // Italy
  | "Tuscany" | "Piedmont" | "Veneto" | "Sicily"
  // Spain
  | "Rioja" | "Ribera del Duero" | "Priorat"
  // Germany & Austria
  | "Germany" | "Austria"
  // Switzerland
  | "Swiss — Vaud" | "Swiss — Valais" | "Swiss — Geneva" | "Swiss — Neuchâtel"
  // New World
  | "Napa Valley" | "Sonoma" | "Argentina" | "Chile"
  | "Australia" | "New Zealand" | "South Africa"
  | "Other"

export type MarkupColor = "green" | "amber" | "red"

export interface RawWine {
  name: string
  producer: string
  vintage: number | null
  type?: WineType
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
  type: WineType
  currency: string
  markupFactor: number
  totalValueScore: number
  markupColor: MarkupColor
  sommelierNote: string
}

export interface ProcessResult {
  success: boolean
  wines?: ScoredWine[]
  currency?: string
  error?: string
}

export function scoreWine(wine: RawWine, index: number): ScoredWine {
  const marketPrice = wine.marketPrice > 0 ? wine.marketPrice : wine.restaurantPrice / 2.5
  const markupFactor =
    Math.round((wine.restaurantPrice / marketPrice) * 10) / 10

  // Markup component: ideal ≤2.5×; penalise above 3.5×; floor at 0
  const markupComponent = Math.max(0, Math.min(40, (5 - markupFactor) * 10))
  // Critic component: raw score × 0.6 (100pt wine → 60pts max)
  const criticComponent = wine.criticScore * 0.6
  const totalValueScore = Math.round(criticComponent + markupComponent)

  // green ≤2.5×, amber 2.5–3.5×, red >3.5×
  const markupColor: MarkupColor =
    markupFactor <= 2.5 ? "green" : markupFactor <= 3.5 ? "amber" : "red"

  const sommelierNote =
    wine.sommelierNote ||
    `${wine.region} at ${markupFactor.toFixed(1)}× — ${wine.criticScore} pts.`

  return {
    ...wine,
    id: `wine-${index}`,
    type: wine.type ?? "Red",
    currency: wine.currency ?? "CHF",
    markupFactor,
    totalValueScore,
    markupColor,
    marketPrice,
    sommelierNote,
  }
}

export function scoreAndRankWines(wines: RawWine[]): ScoredWine[] {
  return wines
    .map(scoreWine)
    .sort((a, b) => b.totalValueScore - a.totalValueScore)
}
