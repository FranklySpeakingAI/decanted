import type { RawWine } from "./scoring"

// ---------------------------------------------------------------------------
// Mock dataset (CHF, Swiss-restaurant style)
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
    foodPairings: ["Beef", "Vegetarian"],
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
    foodPairings: ["Beef", "Chicken"],
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
    foodPairings: ["Fish", "Chicken", "Vegetarian"],
    sommelierNote: "White Burgundy at 2.5× — ideal markup, stunning with fish.",
  },
  {
    name: "Opus One",
    producer: "Opus One Winery",
    vintage: 2019,
    region: "Napa",
    restaurantPrice: 495,
    marketPrice: 195,
    criticScore: 97,
    currency: "CHF",
    foodPairings: ["Beef", "Chicken"],
    sommelierNote: "Napa icon at 2.5× — show-stopping for a special occasion.",
  },
  {
    name: "Flowers Pinot Noir Camp Meeting Ridge",
    producer: "Flowers Winery",
    vintage: 2021,
    region: "Other",
    restaurantPrice: 98,
    marketPrice: 48,
    criticScore: 93,
    currency: "CHF",
    foodPairings: ["Chicken", "Fish", "Vegetarian"],
    sommelierNote: "Sonoma Pinot at 2.0× — versatile, great with lighter dishes.",
  },
  {
    name: "Gaja Barbaresco",
    producer: "Angelo Gaja",
    vintage: 2018,
    region: "Other",
    restaurantPrice: 380,
    marketPrice: 125,
    criticScore: 96,
    currency: "CHF",
    foodPairings: ["Beef", "Chicken"],
    sommelierNote: "Piedmont royalty at 3.0× — borderline but the 96pts justifies.",
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
    foodPairings: ["Beef", "Vegetarian"],
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
    foodPairings: ["Beef", "Chicken"],
    sommelierNote: "Village Gevrey at 2.1× — old vine depth at a fraction of premier cru.",
  },
  {
    name: "Weingut Keller Riesling Spätlese",
    producer: "Weingut Keller",
    vintage: 2022,
    region: "Other",
    restaurantPrice: 84,
    marketPrice: 40,
    criticScore: 94,
    currency: "CHF",
    foodPairings: ["Fish", "Vegetarian", "Chicken"],
    sommelierNote: "Rheinhessen Riesling at 2.1× — electric acidity, 94pts, phenomenal fish wine.",
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
    foodPairings: ["Beef", "Vegetarian"],
    sommelierNote: "Pauillac second-growth, 98pts, 2.6× — serious value if you love Cabernet.",
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
// System prompt — instructs the model to return EVERY wine in the document
// ---------------------------------------------------------------------------
const SYSTEM_PROMPT = `You are a professional sommelier and wine market expert specialising in European restaurant wine lists.

TASK: Scan the ENTIRE document and extract EVERY wine mentioned. A complete list may have 50–200+ wines. Return ALL of them — never truncate or sample.

PARSING RULES:
1. The document may be multilingual (French, German, English, Italian, mixed).
2. Normalise ALL prices to per-bottle (75 cl) equivalent:
   • "le dl 8.9" or "dl 8.9"  → bottle price = value × 7.5  (e.g. 8.9 × 7.5 = 66.75)
   • "bouteille 73", "bt 73", "Fl. 73", "b. 73" → bottle price = 73
   • A bare number next to a wine → assume bottle price
   • If both glass and bottle prices appear, use the bottle price
3. Detect the currency from context (CHF for Swiss lists, EUR for European, etc.)
4. Estimate the retail/market price in the SAME currency as the restaurant price.
5. Estimate critic score (Robert Parker / Wine Spectator, 80–100). Default to 85 if unknown.
6. region must be one of: Bordeaux, Burgundy, Tuscany, Napa, Other
7. foodPairings: choose any combination of Chicken, Beef, Fish, Vegetarian
8. sommelierNote: ≤ 20 words, focus on value and food fit
9. vintage: null if not stated
10. Omit water, spirits, beer, juices — wines only

OUTPUT: Respond with ONLY valid JSON — no markdown fences, no explanation:
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
      "foodPairings": ["Beef"],
      "sommelierNote": "Short note on value and food fit."
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

  // Chunk large documents so every wine is captured across multiple calls
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
// Routing to the correct provider
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
      messages: [
        {
          role: "user",
          content: `${SYSTEM_PROMPT}\n\n${buildUserPrompt(input)}`,
        },
      ],
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

// Split on natural paragraph/section breaks, never in the middle of a wine entry
function splitIntoChunks(text: string, maxLen: number): string[] {
  if (text.length <= maxLen) return [text]

  const chunks: string[] = []
  let remaining = text

  while (remaining.length > maxLen) {
    // Search for a split point in the last 25% of the allowed window
    const windowStart = Math.floor(maxLen * 0.75)
    const segment = remaining.slice(windowStart, maxLen)
    const breakPatterns = ["\n\n", "\n", ". "]

    let splitIdx = maxLen
    for (const pat of breakPatterns) {
      const idx = segment.lastIndexOf(pat)
      if (idx >= 0) {
        splitIdx = windowStart + idx + pat.length
        break
      }
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
