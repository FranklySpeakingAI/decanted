import type { RawWine, WineRegion, FoodPairing, WineType } from "./scoring"

// ---------------------------------------------------------------------------
// Canonical region taxonomy — server-side only, embedded in the LLM prompt.
// ---------------------------------------------------------------------------
const WINE_REGIONS = {
  // France
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

  // Italy
  Tuscany:      ["Chianti", "Brunello di Montalcino", "Bolgheri",
                 "Vino Nobile di Montepulciano", "Super Tuscan"],
  Piedmont:     ["Barolo", "Barbaresco", "Barbera d'Asti", "Dolcetto"],
  Veneto:       ["Amarone", "Soave", "Valpolicella", "Prosecco"],
  Sicily:       ["Etna", "Nero d'Avola", "Marsala"],

  // Spain
  Rioja:        ["Rioja Alta", "Rioja Alavesa", "Rioja Baja"],
  "Ribera del Duero": ["Ribera del Duero"],
  Priorat:      ["Priorat", "Montsant"],

  // Germany & Austria
  Germany:      ["Mosel", "Rheingau", "Rheinhessen", "Pfalz", "Baden"],
  Austria:      ["Wachau", "Kamptal", "Kremstal", "Burgenland"],

  // Switzerland
  "Swiss — Vaud":     ["Lavaux", "La Côte", "Chablais", "Dézaley", "Yvorne",
                       "St-Saphorin", "Epesse", "Mont-sur-Rolle", "Luins"],
  "Swiss — Valais":   ["Sion", "Fully", "Sierre", "Flanthey", "Lens",
                       "Martigny", "Vétroz"],
  "Swiss — Geneva":   ["Bardonnex", "Lully", "Satigny", "Dardagny"],
  "Swiss — Neuchâtel":["Auvernier", "Cortaillod", "Boudry"],

  // New World
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
// Mock dataset — includes type field
// ---------------------------------------------------------------------------
const MOCK_WINES: RawWine[] = [
  {
    name: "Château Léoville-Barton",
    producer: "Anthony Barton",
    vintage: 2016,
    type: "Red",
    region: "Bordeaux",
    restaurantPrice: 195,
    marketPrice: 80,
    criticScore: 96,
    currency: "CHF",
    foodPairings: ["Red Meat", "Vegetarian"],
    sommelierNote: "Saint-Julien at 2.4× — 96-point vintage, textbook markup.",
  },
  {
    name: "Sassicaia",
    producer: "Tenuta San Guido",
    vintage: 2020,
    type: "Red",
    region: "Tuscany",
    restaurantPrice: 175,
    marketPrice: 92,
    criticScore: 97,
    currency: "CHF",
    foodPairings: ["Red Meat", "White Meat"],
    sommelierNote: "Bolgheri benchmark at 1.9× — close to retail, supreme value.",
  },
  {
    name: "Domaine Leflaive Puligny-Montrachet 1er Cru",
    producer: "Domaine Leflaive",
    vintage: 2021,
    type: "White",
    region: "Burgundy",
    restaurantPrice: 290,
    marketPrice: 115,
    criticScore: 95,
    currency: "CHF",
    foodPairings: ["Fish", "White Meat", "Vegetarian"],
    sommelierNote: "White Burgundy at 2.5× — ideal markup, stunning with fish.",
  },
  {
    name: "Opus One",
    producer: "Opus One Winery",
    vintage: 2019,
    type: "Red",
    region: "Napa Valley",
    restaurantPrice: 495,
    marketPrice: 195,
    criticScore: 97,
    currency: "CHF",
    foodPairings: ["Red Meat", "White Meat"],
    sommelierNote: "Napa icon at 2.5× — show-stopping for a special occasion.",
  },
  {
    name: "Flowers Pinot Noir Camp Meeting Ridge",
    producer: "Flowers Winery",
    vintage: 2021,
    type: "Red",
    region: "Sonoma",
    restaurantPrice: 98,
    marketPrice: 48,
    criticScore: 93,
    currency: "CHF",
    foodPairings: ["White Meat", "Fish", "Vegetarian"],
    sommelierNote: "Sonoma Pinot at 2.0× — versatile, great with lighter dishes.",
  },
  {
    name: "Gaja Barbaresco",
    producer: "Angelo Gaja",
    vintage: 2018,
    type: "Red",
    region: "Piedmont",
    restaurantPrice: 380,
    marketPrice: 125,
    criticScore: 96,
    currency: "CHF",
    foodPairings: ["Red Meat", "Game"],
    sommelierNote: "Piedmont royalty at 3.0× — earthy, tannic, built for game.",
  },
  {
    name: "Château Margaux",
    producer: "Château Margaux",
    vintage: 2017,
    type: "Red",
    region: "Bordeaux",
    restaurantPrice: 895,
    marketPrice: 210,
    criticScore: 98,
    currency: "CHF",
    foodPairings: ["Red Meat"],
    sommelierNote: "First-growth at 4.3× — steep, but 98 points speaks for itself.",
  },
  {
    name: "Gevrey-Chambertin Vieilles Vignes",
    producer: "Rossignol-Trapet",
    vintage: 2020,
    type: "Red",
    region: "Burgundy",
    restaurantPrice: 118,
    marketPrice: 55,
    criticScore: 91,
    currency: "CHF",
    foodPairings: ["Game", "Red Meat"],
    sommelierNote: "Old-vine Gevrey at 2.1× — earthy depth perfect for game.",
  },
  {
    name: "Weingut Keller Riesling Spätlese",
    producer: "Weingut Keller",
    vintage: 2022,
    type: "White",
    region: "Germany",
    restaurantPrice: 84,
    marketPrice: 40,
    criticScore: 94,
    currency: "CHF",
    foodPairings: ["Fish", "Vegetarian", "White Meat"],
    sommelierNote: "Rheinhessen Riesling at 2.1× — 94pts, phenomenal fish wine.",
  },
  {
    name: "Château Pichon Baron",
    producer: "Château Pichon Baron",
    vintage: 2015,
    type: "Red",
    region: "Bordeaux",
    restaurantPrice: 235,
    marketPrice: 90,
    criticScore: 98,
    currency: "CHF",
    foodPairings: ["Red Meat"],
    sommelierNote: "Pauillac second-growth, 98pts, 2.6× — serious Cabernet value.",
  },
]

// ---------------------------------------------------------------------------
// LLM integration
// ---------------------------------------------------------------------------

export interface LLMInput {
  mode: "url" | "file"
  content: string
}

interface LLMResponse {
  currency: string
  wines: RawWine[]
}

// ---------------------------------------------------------------------------
// Chunk system prompt (used for every LLM call)
// ---------------------------------------------------------------------------
const CHUNK_SYSTEM_PROMPT = `You are a wine list parser. Extract EVERY wine mentioned in this text segment. For each wine return a JSON object with these exact fields: name, producer, vintage (number or null), menuPrice (number in local currency), type (exactly one of: Red | White | Rosé | Champagne | Sparkling | Dessert | Non-Alcoholic), region (mapped from the WINE_REGIONS taxonomy), pairings (array from: Red Meat | White Meat | Game | Fish | Vegetarian), estimatedMarketPrice (number), criticScore (number 0–100 or null), markup (menuPrice divided by estimatedMarketPrice). Return ONLY a valid JSON array. No prose, no markdown, no explanation. If a field is unknown use null.

Normalise ALL prices to per-bottle (75 cl) equivalent:
• "le dl 8.9" or "dl 8.9" → bottle price = value × 7.5
• "bouteille 73", "bt 73", "Fl. 73", "b. 73" → bottle price = 73
• A bare number next to a wine → assume bottle price
• If both glass and bottle prices appear, use the bottle price only

Detect the currency from context (CHF for Swiss lists, EUR for European, etc.).
Estimate the retail/market price in the SAME currency as the restaurant price.
Estimate critic score (Robert Parker / Wine Spectator, 80–100). Default to 85 if unknown.
Omit water, spirits, beer, juices — wines only.

WINE_REGIONS taxonomy (map each wine to exactly one key; use "Other" if unknown):
${REGION_TAXONOMY}`

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------
export async function getLLMResponse(input: LLMInput): Promise<RawWine[]> {
  const openaiKey = process.env.OPENAI_API_KEY
  const anthropicKey = process.env.ANTHROPIC_API_KEY

  if (!openaiKey && !anthropicKey) {
    console.log("[LLM] No API key found — returning mock data")
    await new Promise((r) => setTimeout(r, 1800))
    return MOCK_WINES
  }

  const provider = openaiKey ? "OpenAI" : "Anthropic"
  console.log(`[LLM] Using ${provider}`)

  // ~3000 tokens per chunk (~12 000 chars), ~200-token overlap (~800 chars)
  const chunks = splitIntoChunks(input.content, 12_000, 800)
  console.log(`[LLM] ${chunks.length} chunk(s) from ${input.content.length} chars`)

  const allWines: RawWine[] = []
  let detectedCurrency = "CHF"
  const errors: string[] = []

  for (let i = 0; i < chunks.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 1_500))
    try {
      console.log(`[LLM] Processing chunk ${i + 1}/${chunks.length} (${chunks[i].length} chars)`)
      const resp = await callLLM(chunks[i], openaiKey, anthropicKey)
      if (resp.currency) detectedCurrency = resp.currency
      console.log(`[LLM] Chunk ${i + 1} returned ${resp.wines.length} wine(s)`)
      allWines.push(...resp.wines)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[LLM] Chunk ${i + 1} error:`, msg)
      errors.push(msg)
    }
  }

  const merged = deduplicateWines(allWines).map((w) => ({
    ...w,
    currency: w.currency ?? detectedCurrency,
  }))

  console.log(`[LLM] Total after dedup: ${merged.length} wines`)

  if (merged.length === 0) {
    const reason = errors.length > 0 ? errors[0] : "LLM returned no wines"
    throw new Error(`LLM extraction failed: ${reason}`)
  }

  return merged
}

// ---------------------------------------------------------------------------
// Provider routing
// ---------------------------------------------------------------------------
async function callLLM(
  chunk: string,
  openaiKey?: string,
  anthropicKey?: string,
): Promise<LLMResponse> {
  if (openaiKey) return callOpenAI(chunk, openaiKey)
  if (anthropicKey) return callAnthropic(chunk, anthropicKey)
  throw new Error("No API key")
}

async function callOpenAI(chunk: string, apiKey: string): Promise<LLMResponse> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: CHUNK_SYSTEM_PROMPT },
        { role: "user", content: `Extract all wines from this text:\n\n${chunk}` },
      ],
      temperature: 0.1,
      max_tokens: 8000,
    }),
    signal: AbortSignal.timeout(55_000),
  })
  if (!res.ok) throw new Error(`OpenAI ${res.status}`)
  const data = await res.json()
  return parseChunkResponse(data.choices?.[0]?.message?.content ?? "")
}

async function callAnthropic(chunk: string, apiKey: string, attempt = 0): Promise<LLMResponse> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 8000,
      system: CHUNK_SYSTEM_PROMPT,
      messages: [{ role: "user", content: `Extract all wines from this text:\n\n${chunk}` }],
    }),
    signal: AbortSignal.timeout(55_000),
  })

  if (res.status === 429 && attempt < 3) {
    // Honour Retry-After if present, otherwise exponential backoff
    const retryAfter = res.headers.get("retry-after")
    const waitMs = retryAfter ? parseInt(retryAfter) * 1000 : (attempt + 1) * 8_000
    console.log(`[LLM] 429 rate limit — waiting ${waitMs}ms before retry ${attempt + 1}/3`)
    await new Promise((r) => setTimeout(r, waitMs))
    return callAnthropic(chunk, apiKey, attempt + 1)
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`Anthropic ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`)
  }
  const data = await res.json()
  return parseChunkResponse(data.content?.[0]?.text ?? "")
}

// ---------------------------------------------------------------------------
// Response parsing
// ---------------------------------------------------------------------------
function parseChunkResponse(text: string, currency = "CHF"): LLMResponse {
  // Chunk responses are JSON arrays
  const arrStart = text.indexOf("[")
  if (arrStart !== -1) {
    const arrEnd = text.lastIndexOf("]")
    if (arrEnd > arrStart) {
      try {
        const arr = JSON.parse(text.slice(arrStart, arrEnd + 1))
        if (Array.isArray(arr)) {
          // Detect currency from first wine that has it
          const detectedCurrency = arr.find((w) => w.currency)?.currency ?? currency
          return { currency: detectedCurrency, wines: arr.map((w) => mapChunkWine(w, detectedCurrency)) }
        }
      } catch { /* fall through to object parse */ }
    }
  }

  // Fallback: legacy object format { currency, wines: [...] }
  const objStart = text.indexOf("{")
  if (objStart === -1) throw new Error("No JSON in LLM response")
  const parsed = JSON.parse(text.slice(objStart))
  if (!Array.isArray(parsed?.wines)) throw new Error("Unexpected LLM JSON shape")
  const detectedCurrency = parsed.currency ?? currency
  return {
    currency: detectedCurrency,
    wines: parsed.wines.map((w: Record<string, unknown>) => mapChunkWine(w, detectedCurrency)),
  }
}

// Maps the chunk response field names to RawWine field names
function mapChunkWine(w: Record<string, unknown>, currency: string): RawWine {
  const menuPrice = Number(w.menuPrice ?? w.restaurantPrice) || 0
  const marketPrice =
    Number(w.estimatedMarketPrice ?? w.marketPrice) ||
    Math.round(menuPrice / 2.5) ||
    1

  return {
    name: String(w.name ?? "Unknown"),
    producer: String(w.producer ?? "Unknown"),
    vintage: w.vintage != null ? Number(w.vintage) || null : null,
    type: (w.type as WineType) ?? "Red",
    region: ((w.region as string) ?? "Other") as WineRegion,
    restaurantPrice: menuPrice,
    marketPrice,
    criticScore: w.criticScore != null ? Number(w.criticScore) || 85 : 85,
    foodPairings: (Array.isArray(w.pairings) ? w.pairings : w.foodPairings
      ? (w.foodPairings as unknown[])
      : []) as FoodPairing[],
    sommelierNote: String(w.sommelierNote ?? ""),
    currency,
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function splitIntoChunks(text: string, maxLen: number, overlap: number): string[] {
  if (text.length <= maxLen) return [text]
  const chunks: string[] = []
  let pos = 0
  while (pos < text.length) {
    const end = Math.min(pos + maxLen, text.length)
    // Try to break at a paragraph or line boundary near the end of the window
    let splitAt = end
    if (end < text.length) {
      const windowStart = Math.max(pos, end - 400)
      const segment = text.slice(windowStart, end)
      for (const pat of ["\n\n", "\n", ". "]) {
        const idx = segment.lastIndexOf(pat)
        if (idx >= 0) { splitAt = windowStart + idx + pat.length; break }
      }
    }
    chunks.push(text.slice(pos, splitAt))
    if (splitAt >= text.length) break
    pos = Math.max(pos + 1, splitAt - overlap)
  }
  return chunks
}

function deduplicateWines(wines: RawWine[]): RawWine[] {
  const seen = new Map<string, RawWine>()
  for (const w of wines) {
    const key = `${w.name.toLowerCase().trim()}|${w.vintage ?? ""}|${w.producer.toLowerCase().trim()}`
    if (!seen.has(key)) seen.set(key, w)
  }
  return Array.from(seen.values())
}
