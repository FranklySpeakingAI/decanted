import type { RawWine, WineRegion, FoodPairing, WineType } from "./scoring"

// ---------------------------------------------------------------------------
// Canonical region taxonomy
// ---------------------------------------------------------------------------
const WINE_REGIONS = {
  Bordeaux:     ["Pauillac", "Margaux", "St-Estèphe", "St-Julien", "Graves",
                 "Pessac-Léognan", "Pomerol", "St-Emilion", "Haut-Médoc",
                 "Moulis", "Listrac", "Sauternes", "Médoc"],
  Burgundy:     ["Côte de Nuits", "Côte de Beaune", "Nuits-Saint-Georges",
                 "Gevrey-Chambertin", "Meursault", "Puligny-Montrachet",
                 "Chassagne-Montrachet", "Beaune", "Pommard", "Volnay",
                 "Mâcon", "Chablis", "Viré-Clessé", "Bouzeron", "Montagny"],
  Champagne:    ["Aÿ", "Avize", "Bouzy", "Ambonnay", "Louvois", "Épernay",
                 "Reims", "Vallée de la Marne"],
  "Rhône":      ["Châteauneuf-du-Pape", "Hermitage", "Crozes-Hermitage",
                 "Côte Rôtie", "Gigondas", "Vacqueyras", "Condrieu"],
  Alsace:       ["Alsace Grand Cru", "Riesling Alsace", "Gewurztraminer",
                 "Pinot Gris Alsace"],
  Loire:        ["Sancerre", "Pouilly-Fumé", "Muscadet", "Vouvray",
                 "Chinon", "Bourgueil", "Saumur"],
  Languedoc:    ["Corbières", "Minervois", "Fitou", "Pic Saint-Loup",
                 "Saint-Guilhem-le-Désert", "Montpeyroux", "Côtes Catalanes",
                 "Duché d'Uzès", "IGP Gers"],
  Provence:     ["Bandol", "Côtes de Provence", "Luberon", "Les Baux"],
  Jura:         ["Arbois", "Côte du Jura", "Vin Jaune", "Étoile"],
  Beaujolais:   ["Morgon", "Moulin-à-Vent", "Fleurie", "Juliénas",
                 "Brouilly", "Chiroubles"],
  "Southwest France": ["Cahors", "Madiran", "Gaillac", "Bergerac"],
  Tuscany:      ["Chianti", "Brunello di Montalcino", "Bolgheri",
                 "Vino Nobile di Montepulciano", "Super Tuscan"],
  Piedmont:     ["Barolo", "Barbaresco", "Barbera d'Asti", "Dolcetto"],
  Veneto:       ["Amarone", "Soave", "Valpolicella", "Prosecco"],
  Sicily:       ["Etna", "Nero d'Avola", "Marsala"],
  Rioja:        ["Rioja Alta", "Rioja Alavesa", "Rioja Baja"],
  "Ribera del Duero": ["Ribera del Duero"],
  Priorat:      ["Priorat", "Montsant"],
  Germany:      ["Mosel", "Rheingau", "Rheinhessen", "Pfalz", "Baden"],
  Austria:      ["Wachau", "Kamptal", "Kremstal", "Burgenland"],
  "Swiss — Vaud":     ["Lavaux", "La Côte", "Chablais", "Dézaley", "Yvorne",
                       "St-Saphorin", "Epesse", "Mont-sur-Rolle", "Luins"],
  "Swiss — Valais":   ["Sion", "Fully", "Sierre", "Flanthey", "Lens",
                       "Martigny", "Vétroz"],
  "Swiss — Geneva":   ["Bardonnex", "Lully", "Satigny", "Dardagny"],
  "Swiss — Neuchâtel":["Auvernier", "Cortaillod", "Boudry"],
  "Napa Valley":  ["Napa", "Oakville", "Rutherford", "Stags Leap", "Howell Mountain"],
  Sonoma:         ["Russian River Valley", "Dry Creek Valley", "Alexander Valley"],
  Argentina:      ["Mendoza", "Malbec Argentina"],
  Chile:          ["Maipo", "Colchagua", "Casablanca"],
  Australia:      ["Barossa Valley", "McLaren Vale", "Margaret River", "Clare Valley"],
  "New Zealand":  ["Marlborough", "Central Otago", "Hawke's Bay"],
  "South Africa": ["Stellenbosch", "Swartland", "Franschhoek"],
} as const

const REGION_TAXONOMY = Object.entries(WINE_REGIONS)
  .map(([key, hints]) => `  "${key}": [${hints.map((h) => `"${h}"`).join(", ")}]`)
  .join("\n")

// ---------------------------------------------------------------------------
// Pipeline guardrails
// ---------------------------------------------------------------------------
const LIMITS = {
  maxExtractedChars:  40_000,
  maxWineLines:          300,
  maxWinesForRanking:    150,
} as const

// ---------------------------------------------------------------------------
// Mock dataset
// ---------------------------------------------------------------------------
const MOCK_WINES: RawWine[] = [
  {
    name: "Château Léoville-Barton", producer: "Anthony Barton",
    vintage: 2016, type: "Red", region: "Bordeaux",
    restaurantPrice: 195, marketPrice: 80, criticScore: 96, currency: "CHF",
    foodPairings: ["Red Meat", "Vegetarian"],
    sommelierNote: "Saint-Julien at 2.4× — 96-point vintage, textbook markup.",
  },
  {
    name: "Sassicaia", producer: "Tenuta San Guido",
    vintage: 2020, type: "Red", region: "Tuscany",
    restaurantPrice: 175, marketPrice: 92, criticScore: 97, currency: "CHF",
    foodPairings: ["Red Meat", "White Meat"],
    sommelierNote: "Bolgheri benchmark at 1.9× — close to retail, supreme value.",
  },
  {
    name: "Domaine Leflaive Puligny-Montrachet 1er Cru", producer: "Domaine Leflaive",
    vintage: 2021, type: "White", region: "Burgundy",
    restaurantPrice: 290, marketPrice: 115, criticScore: 95, currency: "CHF",
    foodPairings: ["Fish", "White Meat", "Vegetarian"],
    sommelierNote: "White Burgundy at 2.5× — ideal markup, stunning with fish.",
  },
  {
    name: "Opus One", producer: "Opus One Winery",
    vintage: 2019, type: "Red", region: "Napa Valley",
    restaurantPrice: 495, marketPrice: 195, criticScore: 97, currency: "CHF",
    foodPairings: ["Red Meat", "White Meat"],
    sommelierNote: "Napa icon at 2.5× — show-stopping for a special occasion.",
  },
  {
    name: "Flowers Pinot Noir Camp Meeting Ridge", producer: "Flowers Winery",
    vintage: 2021, type: "Red", region: "Sonoma",
    restaurantPrice: 98, marketPrice: 48, criticScore: 93, currency: "CHF",
    foodPairings: ["White Meat", "Fish", "Vegetarian"],
    sommelierNote: "Sonoma Pinot at 2.0× — versatile, great with lighter dishes.",
  },
  {
    name: "Gaja Barbaresco", producer: "Angelo Gaja",
    vintage: 2018, type: "Red", region: "Piedmont",
    restaurantPrice: 380, marketPrice: 125, criticScore: 96, currency: "CHF",
    foodPairings: ["Red Meat", "Game"],
    sommelierNote: "Piedmont royalty at 3.0× — earthy, tannic, built for game.",
  },
  {
    name: "Château Margaux", producer: "Château Margaux",
    vintage: 2017, type: "Red", region: "Bordeaux",
    restaurantPrice: 895, marketPrice: 210, criticScore: 98, currency: "CHF",
    foodPairings: ["Red Meat"],
    sommelierNote: "First-growth at 4.3× — steep, but 98 points speaks for itself.",
  },
  {
    name: "Gevrey-Chambertin Vieilles Vignes", producer: "Rossignol-Trapet",
    vintage: 2020, type: "Red", region: "Burgundy",
    restaurantPrice: 118, marketPrice: 55, criticScore: 91, currency: "CHF",
    foodPairings: ["Game", "Red Meat"],
    sommelierNote: "Old-vine Gevrey at 2.1× — earthy depth perfect for game.",
  },
  {
    name: "Weingut Keller Riesling Spätlese", producer: "Weingut Keller",
    vintage: 2022, type: "White", region: "Germany",
    restaurantPrice: 84, marketPrice: 40, criticScore: 94, currency: "CHF",
    foodPairings: ["Fish", "Vegetarian", "White Meat"],
    sommelierNote: "Rheinhessen Riesling at 2.1× — 94pts, phenomenal fish wine.",
  },
  {
    name: "Château Pichon Baron", producer: "Château Pichon Baron",
    vintage: 2015, type: "Red", region: "Bordeaux",
    restaurantPrice: 235, marketPrice: 90, criticScore: 98, currency: "CHF",
    foodPairings: ["Red Meat"],
    sommelierNote: "Pauillac second-growth, 98pts, 2.6× — serious Cabernet value.",
  },
]

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface LLMInput {
  mode: "url" | "file"
  content: string
}

interface LLMResponse {
  currency: string
  wines: RawWine[]
}

interface ExtractedWine {
  name: string
  vintage: number | null
  menuPrice: number
  type: WineType
  region: string
}

// ---------------------------------------------------------------------------
// Layer 1 — Regex pre-filter (zero API cost)
// ---------------------------------------------------------------------------
function extractWineLines(rawText: string): string[] {
  return rawText
    .split("\n")
    .filter((line) => {
      const hasPrice = /\d{2,4}(\.\d{2})?/.test(line)
      const hasYear  = /(19|20)\d{2}/.test(line)
      const tooShort = line.trim().length < 8
      return (hasPrice || hasYear) && !tooShort
    })
    .slice(0, LIMITS.maxWineLines)
}

// ---------------------------------------------------------------------------
// Layer 2A prompt — compact, for cheap/fast model
// ---------------------------------------------------------------------------
const EXTRACTION_PROMPT =
  `You are a wine list parser. Extract wines from these candidate lines.
Return a JSON array. Each element: {"name":string,"vintage":number|null,"menuPrice":number,"type":"Red"|"White"|"Rosé"|"Champagne"|"Sparkling"|"Dessert"|"Non-Alcoholic","region":string}.
Normalise menuPrice to per-bottle (75cl): "dl X" → X×7.5, bare number → bottle price.
Return ONLY a valid JSON array. No prose, no markdown, no explanation.`

// ---------------------------------------------------------------------------
// Layer 2B prompt — with taxonomy, for enrichment model
// ---------------------------------------------------------------------------
const ENRICHMENT_PROMPT =
  `You are a sommelier and wine market expert. Enrich this wine list.
Input: JSON array of {name, vintage, menuPrice, type, region}.
For each wine, add these fields and keep all existing ones:
- producer: winery or producer name (derive from wine name if not explicit)
- region: remap to exactly one key from WINE_REGIONS taxonomy (use "Other" if unknown)
- estimatedMarketPrice: retail estimate in same currency as menuPrice
- criticScore: Parker/Wine Spectator estimate 80–100; use 85 if unknown
- pairings: any from ["Red Meat","White Meat","Game","Fish","Vegetarian"]
- sommelierNote: ≤20 words on value and food fit

Detect currency from context (CHF for Swiss, EUR for European).
Return ONLY: {"currency":"CHF","wines":[...complete enriched array...]}
No prose, no markdown.

WINE_REGIONS taxonomy:
${REGION_TAXONOMY}`

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------
export async function getLLMResponse(input: LLMInput): Promise<RawWine[]> {
  const openaiKey = process.env.OPENAI_API_KEY
  const anthropicKey = process.env.ANTHROPIC_API_KEY

  if (!openaiKey && !anthropicKey) {
    console.log("[LLM] No API key — returning mock data")
    await new Promise((r) => setTimeout(r, 1800))
    return MOCK_WINES
  }

  const provider = openaiKey ? "OpenAI" : "Anthropic"

  const truncated = input.content.slice(0, LIMITS.maxExtractedChars)

  // Layer 1: regex pre-filter — only worth running on large docs.
  // For small docs (<12 k chars) skip it: stripped HTML often loses the
  // newlines that separate name from price, so the filter over-discards.
  let inputForExtraction: string
  if (truncated.length < 12_000) {
    inputForExtraction = truncated
    console.log(`[LLM] Layer 1 skipped (${truncated.length} chars) — sending full text`)
  } else {
    const wineLines = extractWineLines(truncated)
    console.log(`[LLM] Layer 1: ${truncated.length} chars → ${wineLines.length} candidate lines`)
    if (wineLines.length === 0) {
      throw new Error("No wine lines detected. Please check that the document contains a wine list.")
    }
    inputForExtraction = wineLines.join("\n")
  }

  // Layer 2A: cheap model — parse lines into structured JSON
  const extractedRaw = await callExtractionModel(inputForExtraction, openaiKey, anthropicKey)
  const extracted = deduplicateExtracted(extractedRaw).slice(0, LIMITS.maxWinesForRanking)
  console.log(`[LLM] Layer 2A (${provider}): ${extracted.length} wines parsed`)

  if (extracted.length === 0) {
    throw new Error("Could not parse any wines from the document. Please try a different file.")
  }

  // Layer 2B: smart model — enrich with market data, scores, pairings
  let rawWines: RawWine[]
  let detectedCurrency = "CHF"
  try {
    const enriched = await callEnrichmentModel(extracted, openaiKey, anthropicKey)
    detectedCurrency = enriched.currency
    rawWines = enriched.wines
    console.log(`[LLM] Layer 2B (${provider}): ${rawWines.length} wines enriched, currency=${detectedCurrency}`)
  } catch (err) {
    console.error("[LLM] Enrichment failed — using extraction data with defaults:", err instanceof Error ? err.message : err)
    rawWines = extracted.map((w) => wineFromExtracted(w, detectedCurrency))
  }

  return rawWines
}

// ---------------------------------------------------------------------------
// Layer 2A — extraction model call
// ---------------------------------------------------------------------------
async function callExtractionModel(
  lines: string,
  openaiKey?: string,
  anthropicKey?: string,
): Promise<ExtractedWine[]> {
  let text: string

  if (openaiKey) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: EXTRACTION_PROMPT },
          { role: "user", content: lines },
        ],
        temperature: 0,
        max_tokens: 4000,
      }),
      signal: AbortSignal.timeout(20_000),
    })
    if (!res.ok) throw new Error(`OpenAI extraction ${res.status}`)
    const data = await res.json()
    text = data.choices?.[0]?.message?.content ?? ""
  } else if (anthropicKey) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": anthropicKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4000,
        system: EXTRACTION_PROMPT,
        messages: [{ role: "user", content: lines }],
      }),
      signal: AbortSignal.timeout(20_000),
    })
    if (res.status === 429) {
      const after = res.headers.get("retry-after")
      await new Promise((r) => setTimeout(r, after ? parseInt(after) * 1000 : 5_000))
      return callExtractionModel(lines, openaiKey, anthropicKey)
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "")
      throw new Error(`Anthropic extraction ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`)
    }
    const data = await res.json()
    text = data.content?.[0]?.text ?? ""
  } else {
    throw new Error("No API key")
  }

  return parseExtractionResponse(text)
}

// ---------------------------------------------------------------------------
// Layer 2B — enrichment model call
// ---------------------------------------------------------------------------
async function callEnrichmentModel(
  wines: ExtractedWine[],
  openaiKey?: string,
  anthropicKey?: string,
): Promise<LLMResponse> {
  const userContent = JSON.stringify(wines)
  let text: string

  if (openaiKey) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openaiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: ENRICHMENT_PROMPT },
          { role: "user", content: userContent },
        ],
        temperature: 0.1,
        max_tokens: 8000,
      }),
      signal: AbortSignal.timeout(30_000),
    })
    if (!res.ok) throw new Error(`OpenAI enrichment ${res.status}`)
    const data = await res.json()
    text = data.choices?.[0]?.message?.content ?? ""
  } else if (anthropicKey) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": anthropicKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 16000,
        system: ENRICHMENT_PROMPT,
        messages: [{ role: "user", content: userContent }],
      }),
      signal: AbortSignal.timeout(55_000),
    })
    if (res.status === 429) {
      const after = res.headers.get("retry-after")
      await new Promise((r) => setTimeout(r, after ? parseInt(after) * 1000 : 5_000))
      return callEnrichmentModel(wines, openaiKey, anthropicKey)
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "")
      throw new Error(`Anthropic enrichment ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`)
    }
    const data = await res.json()
    text = data.content?.[0]?.text ?? ""
  } else {
    throw new Error("No API key")
  }

  return parseEnrichmentResponse(text)
}

// ---------------------------------------------------------------------------
// Response parsers
// ---------------------------------------------------------------------------
function parseExtractionResponse(text: string): ExtractedWine[] {
  const arrStart = text.indexOf("[")
  if (arrStart === -1) return []
  const arrEnd = text.lastIndexOf("]")
  if (arrEnd <= arrStart) return []
  try {
    const arr = JSON.parse(text.slice(arrStart, arrEnd + 1))
    if (!Array.isArray(arr)) return []
    return arr
      .filter((w) => w.name && typeof w.menuPrice === "number" && w.menuPrice > 0)
      .map((w) => ({
        name: String(w.name),
        vintage: w.vintage != null ? Number(w.vintage) || null : null,
        menuPrice: Number(w.menuPrice),
        type: (w.type as WineType) ?? "Red",
        region: String(w.region ?? "Other"),
      }))
  } catch {
    return []
  }
}

function parseEnrichmentResponse(text: string): LLMResponse {
  const objStart = text.indexOf("{")
  if (objStart === -1) throw new Error("No JSON in enrichment response")
  const parsed = JSON.parse(text.slice(objStart))
  if (!Array.isArray(parsed?.wines)) throw new Error("Unexpected enrichment response shape")
  const currency = String(parsed.currency ?? "CHF")
  return { currency, wines: parsed.wines.map((w: Record<string, unknown>) => mapEnrichedWine(w, currency)) }
}

function mapEnrichedWine(w: Record<string, unknown>, currency: string): RawWine {
  const menuPrice = Number(w.menuPrice ?? w.restaurantPrice) || 0
  const marketPrice =
    Number(w.estimatedMarketPrice ?? w.marketPrice) ||
    Math.round(menuPrice / 2.5) ||
    1
  return {
    name: String(w.name ?? "Unknown"),
    producer: String(w.producer ?? w.name ?? "Unknown"),
    vintage: w.vintage != null ? Number(w.vintage) || null : null,
    type: (w.type as WineType) ?? "Red",
    region: ((w.region as string) ?? "Other") as WineRegion,
    restaurantPrice: menuPrice,
    marketPrice,
    criticScore: w.criticScore != null ? Number(w.criticScore) || 85 : 85,
    foodPairings: (Array.isArray(w.pairings)
      ? w.pairings
      : Array.isArray(w.foodPairings)
      ? w.foodPairings
      : []) as FoodPairing[],
    sommelierNote: String(w.sommelierNote ?? ""),
    currency,
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function deduplicateExtracted(wines: ExtractedWine[]): ExtractedWine[] {
  const seen = new Set<string>()
  return wines.filter((w) => {
    const key = `${w.name.toLowerCase().trim()}|${w.vintage ?? ""}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function wineFromExtracted(w: ExtractedWine, currency: string): RawWine {
  return {
    name: w.name,
    producer: w.name,
    vintage: w.vintage,
    type: w.type,
    region: (w.region as WineRegion) ?? "Other",
    restaurantPrice: w.menuPrice,
    marketPrice: Math.round(w.menuPrice / 2.5) || 1,
    criticScore: 85,
    foodPairings: [],
    sommelierNote: "",
    currency,
  }
}
