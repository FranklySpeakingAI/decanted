import "server-only"
import { createHash } from "node:crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import { getServiceClient } from "@/lib/supabase/server"
import { checkDailyBudget, recordUsage } from "@/lib/budget"
import { canonicalKey } from "@/lib/canonical"
import {
  runExtraction,
  enrichBatch,
  ANTHROPIC_MODEL,
  LIMITS,
  type ExtractedWine,
} from "@/lib/llm"
import type { RawWine, WineRegion, WineType, FoodPairing } from "@/lib/scoring"
import type { WineRow, WineInsert } from "@/lib/supabase/database.types"

export interface PipelineInput {
  content: string
  sourceType: "file" | "url"
  sourceRef: string
  clientIp?: string | null
}
export interface PipelineMeta {
  fromCache: boolean
  dbHits: number
  enriched: number
  total: number
}
export interface PipelineResult {
  wines: RawWine[]
  meta: PipelineMeta
}

function normalizeText(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase()
}
function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex")
}

// A catalog row + this restaurant's menu price → a RawWine. The market data
// comes from the catalog; the restaurant price always comes from THIS scan.
function rawFromCatalog(row: Partial<WineRow>, restaurantPrice: number): RawWine {
  return {
    name: row.name ?? "Unknown",
    producer: row.producer ?? null,
    vintage: row.vintage ?? null,
    type: (row.wine_type as WineType) ?? "Red",
    region: (row.region as WineRegion) ?? "Other",
    restaurantPrice,
    marketPrice: row.market_price_chf ?? null,
    criticScore: row.critic_score ?? null,
    foodPairings: (row.food_pairings as FoodPairing[]) ?? [],
    sommelierNote: row.sommelier_note ?? null,
    priceConfidence: row.price_confidence ?? null,
  }
}

export async function runPipeline(input: PipelineInput): Promise<PipelineResult> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error("Die Weinanalyse ist noch nicht konfiguriert.")

  const supabase = getServiceClient()
  const normalized = normalizeText(input.content)
  const hash = sha256(normalized)

  // 1. Whole-document cache — zero API calls on a repeat scan.
  if (supabase) {
    const cached = await loadCachedScan(supabase, hash)
    if (cached && cached.length) {
      return { wines: cached, meta: { fromCache: true, dbHits: cached.length, enriched: 0, total: cached.length } }
    }
  }

  // Budget gate before the first paid call.
  const budget = await checkDailyBudget()
  if (!budget.ok) {
    throw new Error(
      `Das heutige Scan-Budget (CHF ${budget.capChf}) ist aufgebraucht (CHF ${budget.spentChf.toFixed(2)}). Bitte versuche es morgen wieder.`,
    )
  }

  // 2. Extraction (Haiku). Pass the RAW content — newlines and original case
  //    intact. `normalized` collapses every \n to a space, which flattens the
  //    whole list into a single "line": extractWineLines then can't split it,
  //    so line-based chunking degrades to one giant truncated call (measured:
  //    122 wines vs 265 with newlines preserved). normalized is for hashing only.
  const ex = await runExtraction(key, input.content)
  await recordUsage({ model: ANTHROPIC_MODEL, step: "extraction", usage: ex.usage, clientIp: input.clientIp })
  const extracted = ex.wines
  if (!extracted.length) {
    throw new Error("Es konnten keine Weine aus dem Dokument gelesen werden. Bitte versuche eine andere Datei.")
  }

  // 3. DB match (exact canonical_key, then trigram).
  const catalogHit = supabase ? await matchCatalog(supabase, extracted) : new Map<number, WineRow>()

  // 4. Enrich misses only. Batches run with bounded concurrency so a big cold
  //    list (≈150 wines → ~8 batches) finishes in one wave, not back-to-back.
  //    One budget check up front is enough: each Haiku batch is a few rappen and
  //    the daily cap bounds the total regardless.
  const missIdx = extracted.map((_, i) => i).filter((i) => !catalogHit.has(i))
  const enrichedByIdx = new Map<number, RawWine>()
  if (missIdx.length) {
    const batches: number[][] = []
    for (let b = 0; b < missIdx.length; b += LIMITS.enrichBatchSize) {
      batches.push(missIdx.slice(b, b + LIMITS.enrichBatchSize))
    }
    await mapWithConcurrency(batches, 5, async (slice) => {
      const batch = slice.map((i) => extracted[i])
      try {
        const res = await enrichBatch(key, batch)
        await recordUsage({ model: ANTHROPIC_MODEL, step: "enrichment", usage: res.usage, clientIp: input.clientIp })
        slice.forEach((idx, j) => enrichedByIdx.set(idx, res.wines[j] ?? bareFallback(extracted[idx])))
      } catch (e) {
        // A slow/aborted batch must NOT sink the whole scan — a cold 250-wine
        // list runs a dozen batches and any one can time out. Degrade this
        // batch to bare wines (no market data) and keep the rest.
        console.error("[pipeline] enrich batch failed:", e instanceof Error ? e.message : e)
        slice.forEach((idx) => enrichedByIdx.set(idx, bareFallback(extracted[idx])))
      }
    })
  }

  // 5. Assemble in original order.
  const wines: RawWine[] = extracted.map((exWine, i) => {
    const hit = catalogHit.get(i)
    if (hit) return rawFromCatalog(hit, exWine.menuPrice)
    return enrichedByIdx.get(i) ?? bareFallback(exWine)
  })

  // 6. Persist catalog + scan (best-effort; never block the response).
  if (supabase) {
    await persist(supabase, { hash, input, extracted, wines }).catch((e) =>
      console.error("[pipeline] persist failed:", e instanceof Error ? e.message : e),
    )
  }

  return {
    wines,
    meta: { fromCache: false, dbHits: catalogHit.size, enriched: missIdx.length, total: extracted.length },
  }
}

// Run `worker` over items with at most `limit` in flight at once.
async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++
      await worker(items[i])
    }
  })
  await Promise.all(runners)
}

function bareFallback(ex: ExtractedWine): RawWine {
  return {
    name: ex.name,
    producer: ex.producer,
    vintage: ex.vintage,
    type: ex.type,
    region: (ex.region as WineRegion) ?? "Other",
    restaurantPrice: ex.menuPrice,
    marketPrice: null,
    criticScore: null,
    foodPairings: [],
    sommelierNote: null,
    priceConfidence: null,
  }
}

// ── DB match ─────────────────────────────────────────────────────────────────
async function matchCatalog(
  supabase: SupabaseClient,
  extracted: ExtractedWine[],
): Promise<Map<number, WineRow>> {
  const hits = new Map<number, WineRow>()
  const keys = extracted.map((w) => canonicalKey(w.producer, w.name, w.vintage))

  // 1. Exact canonical_key.
  const { data: exact, error } = await supabase.from("wines").select("*").in("canonical_key", keys)
  if (error) {
    console.error("[pipeline] exact match failed:", error.message)
    return hits
  }
  const byKey = new Map<string, WineRow>((exact ?? []).map((r: WineRow) => [r.canonical_key, r]))
  keys.forEach((k, i) => {
    const row = byKey.get(k)
    if (row) hits.set(i, row)
  })

  // 2. Trigram for the rest.
  const missIdx = extracted.map((_, i) => i).filter((i) => !hits.has(i))
  if (missIdx.length) {
    const names = missIdx.map((i) => extracted[i].name)
    const vintages = missIdx.map((i) => extracted[i].vintage)
    const { data: fuzzy, error: fErr } = await supabase.rpc("match_wines", {
      p_names: names,
      p_vintages: vintages,
    })
    if (fErr) console.error("[pipeline] trigram match failed:", fErr.message)
    else for (const row of (fuzzy ?? []) as (WineRow & { idx: number })[]) {
      const origIdx = missIdx[row.idx - 1] // idx is 1-based ordinality over the miss list
      if (origIdx != null) hits.set(origIdx, row)
    }
  }

  return hits
}

// ── Persist ──────────────────────────────────────────────────────────────────
async function persist(
  supabase: SupabaseClient,
  args: { hash: string; input: PipelineInput; extracted: ExtractedWine[]; wines: RawWine[] },
) {
  // Upsert every wine into the catalog so scan_wines can reference it and future
  // scans get cache hits. Existing rows are left untouched.
  const inserts: WineInsert[] = args.wines.map((w) => ({
    canonical_key: canonicalKey(w.producer, w.name, w.vintage),
    name: w.name,
    producer: w.producer,
    vintage: w.vintage,
    wine_type: w.type ?? "Red",
    region: w.region,
    country: null,
    market_price_chf: w.marketPrice,
    price_confidence: w.priceConfidence ?? (w.marketPrice != null ? "estimated" : null),
    critic_score: w.criticScore,
    food_pairings: w.foodPairings,
    sommelier_note: w.sommelierNote,
    enriched_at: w.marketPrice != null ? new Date().toISOString() : null,
    enrichment_model: w.marketPrice != null ? ANTHROPIC_MODEL : null,
  }))
  // de-dupe by key within this scan
  const uniq = Array.from(new Map(inserts.map((r) => [r.canonical_key, r])).values())
  await supabase.from("wines").upsert(uniq, { onConflict: "canonical_key", ignoreDuplicates: true })

  // Resolve wine ids for this scan's keys.
  const keys = uniq.map((r) => r.canonical_key)
  const { data: rows } = await supabase.from("wines").select("id, canonical_key").in("canonical_key", keys)
  const idByKey = new Map<string, string>((rows ?? []).map((r: { id: string; canonical_key: string }) => [r.canonical_key, r.id]))

  const { data: scan } = await supabase
    .from("scans")
    .insert({
      content_hash: args.hash,
      source_type: args.input.sourceType,
      source_ref: args.input.sourceRef,
      client_ip: args.input.clientIp ?? null,
      wine_count: args.wines.length,
    })
    .select("id")
    .single()
  if (!scan) return

  const seen = new Set<string>()
  const scanWines = args.wines
    .map((w) => {
      const wid = idByKey.get(canonicalKey(w.producer, w.name, w.vintage))
      return wid ? { scan_id: scan.id as string, wine_id: wid, restaurant_price_chf: w.restaurantPrice, raw_line: w.name } : null
    })
    .filter((r): r is NonNullable<typeof r> => r !== null && !seen.has(r.wine_id) && (seen.add(r.wine_id), true))
  if (scanWines.length) await supabase.from("scan_wines").insert(scanWines)
}

// ── Scan cache read ──────────────────────────────────────────────────────────
async function loadCachedScan(supabase: SupabaseClient, hash: string): Promise<RawWine[] | null> {
  const { data: scan } = await supabase
    .from("scans")
    .select("id")
    .eq("content_hash", hash)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!scan) return null

  const { data: rows } = await supabase
    .from("scan_wines")
    .select("restaurant_price_chf, wines(*)")
    .eq("scan_id", scan.id)
  if (!rows || !rows.length) return null

  return rows.map((r: { restaurant_price_chf: number; wines: WineRow | WineRow[] | null }) => {
    const w = (Array.isArray(r.wines) ? r.wines[0] : r.wines) as WineRow
    return rawFromCatalog(w, r.restaurant_price_chf)
  })
}
