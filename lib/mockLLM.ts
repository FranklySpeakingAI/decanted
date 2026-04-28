import type { RawWine } from "./scoring"

// ---------------------------------------------------------------------------
// Canonical region taxonomy — server-side only, embedded in the LLM prompt.
// Keys are the canonical region names returned in the JSON.
// Sub-region lists are matching hints for the model.
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

// Serialise the region map into the prompt once at module load
const REGION_TAXONOMY = Object.entries(WINE_REGIONS)
  .map(([key, hints]) => `  "${key}": [${hints.map((h) => `"${h}"`).join(", ")}]`)
  .join("\n")

// ---------------------------------------------------------------------------
// Mock dataset — updated to new pairing categories and canonical regions
// ---------------------------------------------------------------------------
const MOCK_WINES: RawWine[] = [
  {
    name: "Château Léoville-Barton",
    producer: "Anthony Barton",
    vintage: 2016,
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
// System prompt
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `You are a professional sommelier and wine market expert specialising in European restaurant wine lists.

TASK: Scan the ENTIRE document and extract EVERY wine mentioned. A complete list may have 50–200+ wines. Return ALL of them — never truncate or sample.

━━━ PARSING RULES ━━━
1. The document may be multilingual (French, German, English, Italian, mixed).
2. Normalise ALL prices to per-bottle (75 cl) equivalent:
   • "le dl 8.9" or "dl 8.9"   → bottle price = value × 7.5  (e.g. 8.9 × 7.5 = 66.75)
   • "bouteille 73", "bt 73", "Fl. 73", "b. 73" → bottle price = 73
   • A bare number next to a wine → assume bottle price
   • If both glass and bottle prices appear, use the bottle price only
3. Detect the currency from context (CHF for Swiss lists, EUR for European, etc.)
4. Estimate the retail/market price in the SAME currency as the restaurant price.
5. Estimate critic score (Robert Parker / Wine Spectator, 80–100). Default to 85 if unknown.
6. vintage: null if not stated.
7. Omit water, spirits, beer, juices — wines only.

━━━ REGION MAPPING ━━━
Map each wine to exactly one key from this taxonomy using the sub-region list as matching hints.
If no sub-region matches, use the closest parent key. If truly unknown, use "Other".
NEVER invent region names outside this list.

${REGION_TAXONOMY}

━━━ FOOD PAIRINGS ━━━
Choose any combination from exactly these five options:
• "Red Meat"   — full-bodied reds: Cabernet, Syrah, Malbec, Barolo, aged Bordeaux
• "White Meat" — medium whites and light reds: Chardonnay, Pinot Noir, Viognier, Rosé
• "Game"       — earthy, tannic, high-acid reds: Burgundy Pinot, Rhône, northern Italy, older Bordeaux
• "Fish"       — crisp whites, dry Rosé, Champagne: Chablis, Sancerre, Muscadet, Riesling
• "Vegetarian" — aromatic whites, light reds, natural wines: Riesling, Gamay, Chenin, Grüner

━━━ OUTPUT ━━━
Respond with ONLY valid JSON — no markdown fences, no explanation:
{
  "currency": "CHF",
  "wines": [
    {
      "name": "Wine Name",
      "producer": "Producer Name",
      "vintage": 2019,
      "region": "Bordeaux",
      "restaurantPrice": 84,
      "marketPrice": 38,
      "criticScore": 94,
      "foodPairings": ["Red Meat"],
      "sommelierNote": "Short note on value and food fit (≤ 20 words)."
    }
  ]
}`

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------
export async function getLLMResponse(input: LLMInput): Promise<RawWine[]> {
  const openaiKey = process.env.OPENAI_API_KEY
  const anthropicKey = process.env.ANTHROPIC_API_KEY

  if (!openaiKey && !anthropicKey) {
    await new Promise((r) => setTimeout(r, 1800))
    return MOCK_WINES
  }

  const chunks = splitIntoChunks(input.content, 20_000)
  const allWines: RawWine[] = []
  let detectedCurrency = "CHF"

  for (const chunk of chunks) {
    try {
      const resp = await callLLM({ ...input, content: chunk }, openaiKey, anthropicKey)
      if (resp.currency) detectedCurrency = resp.currency
      allWines.push(...resp.wines)
    } catch (err) {
      console.error("[getLLMResponse] chunk error:", err instanceof Error ? err.message : err)
    }
  }

  const merged = deduplicateWines(allWines).map((w) => ({
    ...w,
    currency: w.currency ?? detectedCurrency,
  }))

  return merged.length > 0 ? merged : MOCK_WINES
}

// ---------------------------------------------------------------------------
// Provider routing
// ---------------------------------------------------------------------------
async function callLLM(
  input: LLMInput,
  openaiKey?: string,
  anthropicKey?: string,
): Promise<LLMResponse> {
  if (openaiKey) return callOpenAI(input, openaiKey)
  if (anthropicKey) return callAnthropic(input, anthropicKey)
  throw new Error("No API key")
}

async function callOpenAI(input: LLMInput, apiKey: string): Promise<LLMResponse> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: buildUserPrompt(input) },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 8000,
    }),
    signal: AbortSignal.timeout(55_000),
  })
  if (!res.ok) throw new Error(`OpenAI ${res.status}`)
  const data = await res.json()
  return parseResponse(data.choices?.[0]?.message?.content ?? "")
}

async function callAnthropic(input: LLMInput, apiKey: string): Promise<LLMResponse> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-opus-4-7",
      max_tokens: 8000,
      messages: [{ role: "user", content: `${SYSTEM_PROMPT}\n\n${buildUserPrompt(input)}` }],
    }),
    signal: AbortSignal.timeout(55_000),
  })
  if (!res.ok) throw new Error(`Anthropic ${res.status}`)
  const data = await res.json()
  return parseResponse(data.content?.[0]?.text ?? "")
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function buildUserPrompt(input: LLMInput): string {
  return input.mode === "url"
    ? `Analyse this wine list scraped from a restaurant website:\n\n${input.content}`
    : `Analyse this wine list from an uploaded document:\n\n${input.content}`
}

function parseResponse(text: string): LLMResponse {
  const start = text.indexOf("{")
  if (start === -1) throw new Error("No JSON in LLM response")
  const parsed = JSON.parse(text.slice(start))
  if (!Array.isArray(parsed?.wines)) throw new Error("Unexpected LLM JSON shape")
  return { currency: parsed.currency ?? "CHF", wines: parsed.wines as RawWine[] }
}

function splitIntoChunks(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text]
  const chunks: string[] = []
  let remaining = text
  while (remaining.length > maxLen) {
    const windowStart = Math.floor(maxLen * 0.75)
    const segment = remaining.slice(windowStart, maxLen)
    const breakPatterns = ["\n\n", "\n", ". "]
    let splitIdx = maxLen
    for (const pat of breakPatterns) {
      const idx = segment.lastIndexOf(pat)
      if (idx >= 0) { splitIdx = windowStart + idx + pat.length; break }
    }
    chunks.push(remaining.slice(0, splitIdx))
    remaining = remaining.slice(splitIdx)
  }
  if (remaining.trim().length > 0) chunks.push(remaining)
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
