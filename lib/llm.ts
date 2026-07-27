import type { RawWine, WineRegion, FoodPairing, WineType } from "./scoring"

// ---------------------------------------------------------------------------
// Anthropic — single provider, BOUNDED retries, usage returned to the caller.
// (Replaces the old unbounded 429 recursion. See rebuild §2.4 hard rules.)
// ---------------------------------------------------------------------------
export const ANTHROPIC_MODEL = "claude-haiku-4-5-20251001"
const MAX_LLM_RETRIES = 2

export interface Usage {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens?: number
  cache_creation_input_tokens?: number
}

interface AnthropicCallOptions {
  system: string
  user: string
  maxTokens: number
  timeoutMs: number
  label: string
  cacheSystem?: boolean // add cache_control on the system block
}

export async function callAnthropic(
  key: string,
  opts: AnthropicCallOptions,
): Promise<{ text: string; usage: Usage }> {
  const system = opts.cacheSystem
    ? [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }]
    : opts.system

  for (let attempt = 0; ; attempt++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: opts.maxTokens,
        system,
        messages: [{ role: "user", content: opts.user }],
      }),
      signal: AbortSignal.timeout(opts.timeoutMs),
    })

    if (res.status === 429 || res.status >= 500) {
      if (attempt >= MAX_LLM_RETRIES) {
        const body = await res.text().catch(() => "")
        throw new Error(`Anthropic ${opts.label} ${res.status} after ${MAX_LLM_RETRIES} retries${body ? `: ${body.slice(0, 200)}` : ""}`)
      }
      const retryAfter = Number(res.headers.get("retry-after"))
      const backoffMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1_000 * 2 ** attempt
      console.warn(`[LLM] ${opts.label} ${res.status} — retry ${attempt + 1}/${MAX_LLM_RETRIES} in ${backoffMs}ms`)
      await new Promise((r) => setTimeout(r, backoffMs))
      continue
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "")
      throw new Error(`Anthropic ${opts.label} ${res.status}${body ? `: ${body.slice(0, 200)}` : ""}`)
    }

    const data = await res.json()
    const u = data.usage ?? {}
    return {
      text: data.content?.[0]?.text ?? "",
      usage: {
        input_tokens: u.input_tokens ?? 0,
        output_tokens: u.output_tokens ?? 0,
        cache_read_input_tokens: u.cache_read_input_tokens ?? 0,
        cache_creation_input_tokens: u.cache_creation_input_tokens ?? 0,
      },
    }
  }
}

// ---------------------------------------------------------------------------
// Region taxonomy (Switzerland-expanded) — kept under 1.5k tokens.
// ---------------------------------------------------------------------------
const WINE_REGIONS = {
  Bordeaux: ["Pauillac", "Margaux", "St-Estèphe", "St-Julien", "Graves", "Pessac-Léognan", "Pomerol", "St-Emilion", "Haut-Médoc", "Sauternes", "Médoc"],
  Burgundy: ["Côte de Nuits", "Côte de Beaune", "Nuits-Saint-Georges", "Gevrey-Chambertin", "Meursault", "Puligny-Montrachet", "Chablis", "Mâcon"],
  Champagne: ["Aÿ", "Avize", "Bouzy", "Épernay", "Reims"],
  "Rhône": ["Châteauneuf-du-Pape", "Hermitage", "Crozes-Hermitage", "Côte Rôtie", "Gigondas", "Condrieu"],
  Alsace: ["Riesling Alsace", "Gewurztraminer", "Pinot Gris Alsace"],
  Loire: ["Sancerre", "Pouilly-Fumé", "Muscadet", "Vouvray", "Chinon"],
  Languedoc: ["Corbières", "Minervois", "Fitou", "Pic Saint-Loup"],
  Provence: ["Bandol", "Côtes de Provence", "Luberon"],
  Jura: ["Arbois", "Côte du Jura", "Vin Jaune"],
  Beaujolais: ["Morgon", "Moulin-à-Vent", "Fleurie", "Brouilly"],
  "Southwest France": ["Cahors", "Madiran", "Gaillac"],
  Tuscany: ["Chianti", "Brunello di Montalcino", "Bolgheri", "Super Tuscan"],
  Piedmont: ["Barolo", "Barbaresco", "Barbera d'Asti"],
  Veneto: ["Amarone", "Soave", "Valpolicella", "Prosecco"],
  Sicily: ["Etna", "Nero d'Avola"],
  Rioja: ["Rioja Alta", "Rioja Alavesa"],
  "Ribera del Duero": ["Ribera del Duero"],
  Priorat: ["Priorat", "Montsant"],
  Germany: ["Mosel", "Rheingau", "Rheinhessen", "Pfalz"],
  Austria: ["Wachau", "Kamptal", "Burgenland"],
  "Swiss — Vaud": ["Lavaux", "La Côte", "Chablais", "Dézaley", "Yvorne", "St-Saphorin"],
  "Swiss — Valais": ["Sion", "Fully", "Sierre", "Vétroz", "Martigny"],
  "Swiss — Geneva": ["Satigny", "Dardagny", "Lully"],
  "Swiss — Neuchâtel": ["Auvernier", "Cortaillod", "Boudry"],
  "Swiss — Ticino": ["Mendrisio", "Sopraceneri", "Sottoceneri"],
  "Swiss — Graubünden": ["Bündner Herrschaft", "Malans", "Jenins", "Fläsch"],
  "Swiss — Zürich": ["Zürichsee", "Weinland"],
  "Swiss — Schaffhausen": ["Hallau", "Klettgau"],
  "Swiss — Thurgau": ["Ottoberg", "Nussbaumen"],
  "Swiss — Aargau": ["Schinznach", "Döttingen"],
  "Napa Valley": ["Napa", "Oakville", "Rutherford", "Stags Leap"],
  Sonoma: ["Russian River Valley", "Dry Creek Valley"],
  Argentina: ["Mendoza", "Malbec Argentina"],
  Chile: ["Maipo", "Colchagua", "Casablanca"],
  Australia: ["Barossa Valley", "McLaren Vale", "Margaret River"],
  "New Zealand": ["Marlborough", "Central Otago"],
  "South Africa": ["Stellenbosch", "Swartland"],
} as const

const REGION_TAXONOMY = Object.entries(WINE_REGIONS)
  .map(([key, hints]) => `  "${key}": [${hints.map((h) => `"${h}"`).join(", ")}]`)
  .join("\n")

export const LIMITS = {
  maxExtractedChars: 40_000,
  maxWineLines: 300,
  maxWinesForRanking: 150,
  enrichBatchSize: 20,
  extractChunkLines: 70, // split large lists so no single extraction call is huge
} as const

// Run `worker` over items with at most `limit` in flight.
async function mapLimit<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) await worker(items[cursor++])
    }),
  )
}

function addUsage(into: Usage, u: Usage) {
  into.input_tokens += u.input_tokens
  into.output_tokens += u.output_tokens
  into.cache_read_input_tokens = (into.cache_read_input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0)
  into.cache_creation_input_tokens = (into.cache_creation_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0)
}

export interface ExtractedWine {
  name: string
  producer: string | null
  vintage: number | null
  menuPrice: number
  type: WineType
  region: string
}

// ---------------------------------------------------------------------------
// Layer 1 — regex pre-filter (zero API cost)
// ---------------------------------------------------------------------------
export function extractWineLines(rawText: string): string[] {
  return rawText
    .split("\n")
    .filter((line) => {
      const hasPrice = /\d{2,4}(\.\d{2})?/.test(line)
      const hasYear = /(19|20)\d{2}/.test(line)
      const tooShort = line.trim().length < 8
      return (hasPrice || hasYear) && !tooShort
    })
    .slice(0, LIMITS.maxWineLines)
}

// ---------------------------------------------------------------------------
// Extraction prompt — keeps the hard-won Swiss 3-column price rules (git f41b77f)
// ---------------------------------------------------------------------------
const EXTRACTION_PROMPT = `You are a wine list parser. Extract all wines from the provided text.
Return a JSON array. Each element: {"name":string,"producer":string|null,"vintage":number|null,"menuPrice":number,"type":"Red"|"White"|"Rosé"|"Champagne"|"Sparkling"|"Dessert"|"Non-Alcoholic","region":string}.

Price rules — always extract the 75cl bottle price (Swiss lists):
- Three-column Swiss format ("1 dl  7.5 dl  Mitnahme"): a price line like "2023 10.50 71.00 28.00" → vintage=2023, menuPrice=71.00 (the SECOND price = 7.5dl bottle price).
- Explicit "0.5 dl · X | 1 dl · Y | 7.5 dl · Z" → use Z.
- "dl X" notation alone → multiply X by 7.5.
- Single bare number → that is the bottle price.

Wine type from section headers in any language:
- Schaumweine / Champagne / Prosecco / Sekt / Crémant / Cava / Mousseux → Sparkling (Champagne only if region is Champagne, France)
- Weissweine / Blanc / Bianco / Blanco / White → White
- Rotweine / Rouge / Rosso / Tinto / Red → Red
- Roséweine / Rosé / Rosato → Rosé
- Dessertweine / Doux / Dolce / Sauternes → Dessert

producer: winery/château if identifiable in the line, else null.
Skip: non-alcoholic drinks, soft drinks, food items, header/footer text, legend lines.
Return ONLY a valid JSON array. No prose, no markdown.`

// ---------------------------------------------------------------------------
// Enrichment prompt — Swiss retail anchored, no invented critic scores.
// ---------------------------------------------------------------------------
const ENRICHMENT_PROMPT = `You are a Swiss sommelier and wine-market expert. Enrich this wine list.
Input: JSON array of {name, producer, vintage, menuPrice, type, region}.
Return ONLY a JSON array; for each wine keep name/vintage/menuPrice/type and add:
- producer: winery/producer (derive from name if not given, else null)
- region: remap to EXACTLY one key from the WINE_REGIONS taxonomy below, or "Other"
- marketPriceChf: estimated SWISS RETAIL price in CHF for a 75cl bottle, as sold at Coop Mondovino / Denner / Flaschenpost level. If you genuinely cannot estimate it, use null — do NOT guess wildly.
- criticScore: integer 80–100 ONLY if you are reasonably confident (Parker/Wine Spectator/Vinum band). If unknown, use null. Never invent a score.
- pairings: subset of ["Red Meat","White Meat","Game","Fish","Vegetarian"]
- sommelierNote: ≤20 words on value and food fit, or null

Currency is always CHF. No prose, no markdown.

WINE_REGIONS taxonomy:
${REGION_TAXONOMY}`

// ---------------------------------------------------------------------------
// Extraction call
// ---------------------------------------------------------------------------
export async function runExtraction(
  key: string,
  text: string,
): Promise<{ wines: ExtractedWine[]; usage: Usage }> {
  const truncated = text.slice(0, LIMITS.maxExtractedChars)

  // Small docs (stripped HTML) → one call on the whole text. Large docs → the
  // regex-prefiltered lines, split into chunks so each call stays small and the
  // chunks run in parallel. A single 150-wine extraction call is too slow and
  // trips the abort timeout.
  let chunks: string[]
  if (truncated.length < 12_000) {
    chunks = [truncated]
  } else {
    const lines = extractWineLines(truncated)
    if (!lines.length) {
      throw new Error("No wine lines detected. Please check that the document contains a wine list.")
    }
    chunks = []
    for (let i = 0; i < lines.length; i += LIMITS.extractChunkLines) {
      chunks.push(lines.slice(i, i + LIMITS.extractChunkLines).join("\n"))
    }
  }
  if (!chunks.some((c) => c.trim())) {
    throw new Error("No wine lines detected. Please check that the document contains a wine list.")
  }

  const usage: Usage = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }
  const all: ExtractedWine[] = []
  await mapLimit(chunks, 5, async (chunk) => {
    const { text: out, usage: u } = await callAnthropic(key, {
      system: EXTRACTION_PROMPT,
      user: chunk,
      maxTokens: 4_000,
      timeoutMs: 40_000,
      label: "extraction",
      cacheSystem: true,
    })
    addUsage(usage, u)
    for (const w of parseExtractionArray(out)) all.push(w)
  })

  const wines = dedupeExtracted(all).slice(0, LIMITS.maxWinesForRanking)
  return { wines, usage }
}

// ---------------------------------------------------------------------------
// Enrichment call (one batch of ≤20 wines)
// ---------------------------------------------------------------------------
export async function enrichBatch(
  key: string,
  batch: ExtractedWine[],
): Promise<{ wines: RawWine[]; usage: Usage }> {
  const { text: out, usage } = await callAnthropic(key, {
    system: ENRICHMENT_PROMPT,
    user: JSON.stringify(batch),
    maxTokens: 4_000,
    timeoutMs: 45_000,
    label: "enrichment",
    cacheSystem: true, // taxonomy is identical across batches (see note in pipeline)
  })
  return { wines: parseEnrichedArray(out, batch), usage }
}

// ---------------------------------------------------------------------------
// Parsers
// ---------------------------------------------------------------------------
function sliceArray(text: string): string {
  const s = text.indexOf("[")
  const e = text.lastIndexOf("]")
  return s !== -1 && e > s ? text.slice(s, e + 1) : "[]"
}

function parseExtractionArray(text: string): ExtractedWine[] {
  try {
    const arr = JSON.parse(sliceArray(text))
    if (!Array.isArray(arr)) return []
    return arr
      .filter((w) => w?.name && typeof w.menuPrice === "number" && w.menuPrice > 0)
      .map((w) => ({
        name: String(w.name),
        producer: w.producer != null ? String(w.producer) : null,
        vintage: w.vintage != null ? Number(w.vintage) || null : null,
        menuPrice: Number(w.menuPrice),
        type: (w.type as WineType) ?? "Red",
        region: String(w.region ?? "Other"),
      }))
  } catch {
    return []
  }
}

// Map an enriched element to RawWine — NO fake defaults. Falls back to the
// extracted wine (with null market data) when the model omits a wine.
function parseEnrichedArray(text: string, batch: ExtractedWine[]): RawWine[] {
  let arr: unknown[] = []
  try {
    const parsed = JSON.parse(sliceArray(text))
    if (Array.isArray(parsed)) arr = parsed
  } catch {
    /* fall through to bare fallback below */
  }

  if (arr.length === 0) return batch.map(rawFromExtracted)

  const byName = new Map<string, Record<string, unknown>>()
  for (const el of arr) {
    if (el && typeof el === "object") {
      const name = String((el as Record<string, unknown>).name ?? "").toLowerCase().trim()
      if (name) byName.set(name, el as Record<string, unknown>)
    }
  }

  return batch.map((ex) => {
    const el = byName.get(ex.name.toLowerCase().trim())
    if (!el) return rawFromExtracted(ex)
    return {
      name: String(el.name ?? ex.name),
      producer: el.producer != null ? String(el.producer) : ex.producer,
      vintage: ex.vintage,
      type: ex.type,
      region: ((el.region as string) ?? ex.region ?? "Other") as WineRegion,
      restaurantPrice: ex.menuPrice,
      marketPrice: numOrNull(el.marketPriceChf),
      criticScore: clampCritic(el.criticScore),
      foodPairings: Array.isArray(el.pairings) ? (el.pairings as FoodPairing[]) : [],
      sommelierNote: el.sommelierNote != null ? String(el.sommelierNote) : null,
      priceConfidence: "estimated",
    }
  })
}

function rawFromExtracted(ex: ExtractedWine): RawWine {
  return {
    name: ex.name,
    producer: ex.producer,
    vintage: ex.vintage,
    type: ex.type,
    region: (ex.region as WineRegion) ?? "Other",
    restaurantPrice: ex.menuPrice,
    marketPrice: null, // no data — never menuPrice/2.5
    criticScore: null, // no data — never 85
    foodPairings: [],
    sommelierNote: null,
    priceConfidence: null,
  }
}

function numOrNull(v: unknown): number | null {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

function clampCritic(v: unknown): number | null {
  const n = Number(v)
  if (!Number.isFinite(n)) return null
  return n >= 80 && n <= 100 ? Math.round(n) : null
}

function dedupeExtracted(wines: ExtractedWine[]): ExtractedWine[] {
  const seen = new Set<string>()
  return wines.filter((w) => {
    const k = `${w.name.toLowerCase().trim()}|${w.vintage ?? ""}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}
