// Prefill orchestrator.
//
//   npx tsx scripts/prefill/run.ts [--source gerstl] [--limit 25] [--dry]
//
// For each enabled source: load robots, read the sitemap, then politely fetch
// product pages up to the cap, parse them, dedupe by canonical_key, and write
// JSONL + a run manifest to data/prefill/. Nothing touches Supabase here — the
// loader (load-to-supabase.ts) consumes the JSONL in a separate, deliberate
// step once the schema exists.

import { writeFileSync, mkdirSync } from "node:fs"
import { join } from "node:path"
import { PoliteFetcher } from "./fetcher"
import { collectProductUrls } from "./sitemap"
import { MAX_PAGES_PER_SOURCE, OUTPUT_DIR, ENABLED_SOURCES } from "./config"
import type { CatalogWine, SourceAdapter } from "./types"
import { gerstl } from "./sources/gerstl"

const ADAPTERS: Record<string, SourceAdapter> = { gerstl }

interface Args {
  source?: string
  limit: number
  dry: boolean
}
function parseArgs(): Args {
  const a = process.argv.slice(2)
  const get = (flag: string) => {
    const i = a.indexOf(flag)
    return i !== -1 ? a[i + 1] : undefined
  }
  return {
    source: get("--source"),
    limit: Number(get("--limit") ?? MAX_PAGES_PER_SOURCE),
    dry: a.includes("--dry"),
  }
}

async function runSource(adapter: SourceAdapter, limit: number, dry: boolean) {
  console.log(`\n=== ${adapter.name} ===`)
  const fetcher = await PoliteFetcher.create(adapter.origin)

  const allUrls = await collectProductUrls(fetcher, adapter.sitemapUrl, adapter.isProductUrl)
  console.log(`[${adapter.name}] ${allUrls.length} product URLs in sitemap; fetching up to ${limit}`)
  const urls = allUrls.slice(0, limit)

  const byKey = new Map<string, CatalogWine>()
  const errors: { url: string; error: string }[] = []
  let fetched = 0

  for (const url of urls) {
    try {
      const html = await fetcher.get(url)
      fetched++
      if (!html) continue
      const wine = adapter.parse(url, html)
      if (!wine) {
        errors.push({ url, error: "unparseable / not a single wine" })
        continue
      }
      // Prefer a real single-bottle price over a derived one on dedupe.
      const existing = byKey.get(wine.canonicalKey)
      if (!existing || (existing.priceBasis !== "single-bottle" && wine.priceBasis === "single-bottle")) {
        byKey.set(wine.canonicalKey, wine)
      }
      if (fetched % 10 === 0) console.log(`[${adapter.name}] ${fetched}/${urls.length} fetched, ${byKey.size} wines`)
    } catch (err) {
      errors.push({ url, error: err instanceof Error ? err.message : String(err) })
    }
  }

  const wines = [...byKey.values()]
  const withScore = wines.filter((w) => w.criticScore != null).length
  const derived = wines.filter((w) => w.priceBasis === "derived-per-bottle").length
  const subs = wines.filter((w) => w.subskription).length

  console.log(
    `[${adapter.name}] done: ${wines.length} unique wines ` +
      `(${withScore} with critic score, ${derived} derived-price, ${subs} en-primeur), ${errors.length} errors`,
  )

  if (dry) {
    console.log(`[${adapter.name}] --dry: sample of 3:`)
    console.log(JSON.stringify(wines.slice(0, 3), null, 2))
    return
  }

  mkdirSync(OUTPUT_DIR, { recursive: true })
  const jsonlPath = join(OUTPUT_DIR, `${adapter.name}.jsonl`)
  writeFileSync(jsonlPath, wines.map((w) => JSON.stringify(w)).join("\n") + "\n")
  const manifest = {
    source: adapter.name,
    runAt: new Date().toISOString(),
    sitemapUrls: allUrls.length,
    fetched,
    uniqueWines: wines.length,
    withCriticScore: withScore,
    derivedPrice: derived,
    enPrimeur: subs,
    errorCount: errors.length,
    errorsSample: errors.slice(0, 20),
  }
  writeFileSync(join(OUTPUT_DIR, `${adapter.name}.manifest.json`), JSON.stringify(manifest, null, 2))
  console.log(`[${adapter.name}] wrote ${jsonlPath} + manifest`)
}

async function main() {
  const args = parseArgs()
  const sources = args.source ? [args.source] : ENABLED_SOURCES
  for (const name of sources) {
    const adapter = ADAPTERS[name]
    if (!adapter) {
      console.error(`Unknown source "${name}". Known: ${Object.keys(ADAPTERS).join(", ")}`)
      continue
    }
    await runSource(adapter, args.limit, args.dry)
  }
}

main().catch((err) => {
  console.error("[prefill] fatal:", err)
  process.exit(1)
})
