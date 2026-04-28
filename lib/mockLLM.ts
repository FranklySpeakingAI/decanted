import type { RawWine } from "./scoring"

// ---------------------------------------------------------------------------
// Mock wine dataset — returned when no API key is configured.
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
    foodPairings: ["Beef", "Vegetarian"],
    sommelierNote:
      "Saint-Julien at 2.4× — textbook markup on a 96-point vintage. Outstanding value for a second-growth.",
  },
  {
    name: "Sassicaia",
    producer: "Tenuta San Guido",
    vintage: 2020,
    region: "Tuscany",
    restaurantPrice: 175,
    marketPrice: 92,
    criticScore: 97,
    foodPairings: ["Beef", "Chicken"],
    sommelierNote:
      "Bolgheri's benchmark at just 1.9× — close to retail. The finest price-to-score ratio on the list.",
  },
  {
    name: "Domaine Leflaive Puligny-Montrachet",
    producer: "Domaine Leflaive",
    vintage: 2021,
    region: "Burgundy",
    restaurantPrice: 290,
    marketPrice: 115,
    criticScore: 95,
    foodPairings: ["Fish", "Chicken", "Vegetarian"],
    sommelierNote:
      "Premier Cru white Burgundy at 2.5× — a rare find this close to fair markup. Perfect with any fish course.",
  },
  {
    name: "Opus One",
    producer: "Opus One Winery",
    vintage: 2019,
    region: "Napa",
    restaurantPrice: 495,
    marketPrice: 195,
    criticScore: 97,
    foodPairings: ["Beef", "Chicken"],
    sommelierNote:
      "Napa icon at 2.5× markup — right at the sweet spot. A show-stopper for a celebratory table.",
  },
  {
    name: "Flowers Pinot Noir Camp Meeting Ridge",
    producer: "Flowers Winery",
    vintage: 2021,
    region: "Other",
    restaurantPrice: 98,
    marketPrice: 48,
    criticScore: 93,
    foodPairings: ["Chicken", "Fish", "Vegetarian"],
    sommelierNote:
      "Sonoma Coast Pinot at 2.0× — honest markup on a versatile food wine. Smart pour for lighter dishes.",
  },
  {
    name: "Gaja Barbaresco",
    producer: "Angelo Gaja",
    vintage: 2018,
    region: "Other",
    restaurantPrice: 380,
    marketPrice: 125,
    criticScore: 96,
    foodPairings: ["Beef", "Chicken"],
    sommelierNote:
      "Piedmont royalty at 3.0× — borderline on markup but the 96-point score earns its place on the podium.",
  },
  {
    name: "Château Margaux",
    producer: "Château Margaux",
    vintage: 2017,
    region: "Bordeaux",
    restaurantPrice: 895,
    marketPrice: 210,
    criticScore: 98,
    foodPairings: ["Beef", "Vegetarian"],
    sommelierNote:
      "First-growth perfection at 4.3× — steep, but the 98-point score softens the blow for true enthusiasts.",
  },
]

// ---------------------------------------------------------------------------
// LLM integration — swap mock for real by setting env vars in .env.local
// ---------------------------------------------------------------------------

export interface LLMInput {
  mode: "url" | "file"
  content: string
}

const SYSTEM_PROMPT = `You are a professional sommelier and wine market expert.
Analyse the provided wine list and return structured data for every wine you can identify.
For each wine estimate:
- Retail market price (USD) based on current market knowledge
- Current critic score (Robert Parker / Wine Spectator, 0–100 scale)
- Food pairing recommendations (choose any of: Chicken, Beef, Fish, Vegetarian)
- A one-line sommelier note (≤ 20 words) on value and food fit

Respond with ONLY valid JSON in this exact structure — no prose, no markdown fences:
{
  "wines": [
    {
      "name": "Wine Name",
      "producer": "Producer Name",
      "vintage": 2019,
      "region": "Bordeaux",
      "restaurantPrice": 150,
      "marketPrice": 65,
      "criticScore": 94,
      "foodPairings": ["Beef", "Chicken"],
      "sommelierNote": "One-line note on value and food fit."
    }
  ]
}

Region must be one of: Bordeaux, Burgundy, Tuscany, Napa, Other.
vintage may be null if unknown. Omit wines with no discernible name or price.`

export async function getLLMResponse(input: LLMInput): Promise<RawWine[]> {
  const openaiKey = process.env.OPENAI_API_KEY
  const anthropicKey = process.env.ANTHROPIC_API_KEY

  if (!openaiKey && !anthropicKey) {
    await new Promise((r) => setTimeout(r, 1800)) // simulate latency
    return MOCK_WINES
  }

  if (openaiKey) return callOpenAI(input, openaiKey)
  if (anthropicKey) return callAnthropic(input, anthropicKey)

  return MOCK_WINES
}

async function callOpenAI(input: LLMInput, apiKey: string): Promise<RawWine[]> {
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
    }),
    signal: AbortSignal.timeout(55_000),
  })

  if (!res.ok) throw new Error(`OpenAI error ${res.status}`)

  const data = await res.json()
  const text: string = data.choices?.[0]?.message?.content ?? ""
  return parseWineJSON(text)
}

async function callAnthropic(
  input: LLMInput,
  apiKey: string,
): Promise<RawWine[]> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-opus-4-7",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `${SYSTEM_PROMPT}\n\n${buildUserPrompt(input)}`,
        },
      ],
    }),
    signal: AbortSignal.timeout(55_000),
  })

  if (!res.ok) throw new Error(`Anthropic error ${res.status}`)

  const data = await res.json()
  const text: string = data.content?.[0]?.text ?? ""
  return parseWineJSON(text)
}

function buildUserPrompt(input: LLMInput): string {
  return input.mode === "url"
    ? `Analyse this restaurant wine list (scraped from their website):\n\n${input.content}`
    : `Analyse this wine list from an uploaded document:\n\n${input.content}`
}

function parseWineJSON(text: string): RawWine[] {
  const jsonStr = text.includes("{") ? text.slice(text.indexOf("{")) : text
  const parsed = JSON.parse(jsonStr)
  if (!Array.isArray(parsed?.wines)) throw new Error("Unexpected LLM JSON shape")
  return parsed.wines as RawWine[]
}
