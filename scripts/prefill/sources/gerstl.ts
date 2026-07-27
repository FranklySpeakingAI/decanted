// Gerstl Weinselektionen adapter (https://www.gerstl.ch).
//
// Gerstl is an Angular SSR app: the full structured product record lives in a
// <script id="ng-state" type="application/json"> transfer-state blob. We parse
// that directly — no HTML scraping, no JSON-LD (there is none).
//
// The blob for a product page also contains sibling format variants (75cl
// bottle, 150cl magnum, 300cl double-magnum, 6/12-bottle cases). The retail
// reference we want is the price of a SINGLE 75cl bottle, so we search the
// variants for that rather than trusting the page's headline price (which may
// be a wooden case).

import type { CatalogWine, CriticRating, SourceAdapter } from "../types"
import {
  canonicalKey,
  mapRegion,
  mapWineType,
  parseCriticScore,
} from "../normalize"

// ── ng-state extraction ─────────────────────────────────────────────────────
// Angular escapes HTML-unsafe chars in the transfer-state text. Reverse them
// before JSON.parse. `&a;` (ampersand) must be undone LAST.
function extractNgState(html: string): unknown | null {
  const m = html.match(/<script id="ng-state" type="application\/json">([\s\S]*?)<\/script>/)
  if (!m) return null
  const json = m[1]
    .replace(/&l;/g, "<")
    .replace(/&g;/g, ">")
    .replace(/&q;/g, '"')
    .replace(/&s;/g, "'")
    .replace(/&a;/g, "&")
  try {
    return JSON.parse(json)
  } catch {
    return null
  }
}

interface GerstlNode {
  flavor?: string
  slug?: string
  sku?: string
  title1?: string
  title2?: string | null
  title3?: string | null
  teaser?: string | null
  country?: { name?: string } | null
  region?: { name?: string } | null
  subregion?: { name?: string } | null
  year?: { key?: string; name?: string } | null
  wineType?: { name?: string } | null
  color?: { name?: string } | null
  price?: number
  size?: { value?: number } | null
  packaging?: { short?: string; quantity?: number } | null
  customRating?: { author?: string; rating?: string; of?: string | number }[] | null
  subskription?: unknown
}

// Walk the ng-state object collecting every node that looks like a product.
function collectProductNodes(root: unknown): GerstlNode[] {
  const out: GerstlNode[] = []
  const seen = new Set<unknown>()
  const walk = (o: unknown) => {
    if (!o || typeof o !== "object" || seen.has(o)) return
    seen.add(o)
    if (Array.isArray(o)) {
      for (const v of o) walk(v)
      return
    }
    const node = o as GerstlNode
    if (node.flavor === "product" && node.sku) out.push(node)
    for (const v of Object.values(o)) walk(v)
  }
  walk(root)
  return out
}

// Carton size a variant ships in ("75 cl (CT-12)" → 12, "… (OWC-6)" → 6,
// single bottle → 1). NOTE: Gerstl's `price` is already the per-bottle price
// for the stated size, so carton size does NOT divide the price — we only use
// it to PREFER buy-single variants (which carry the honest single-bottle retail
// price) over bulk-carton lines.
function cartonSize(node: GerstlNode): number {
  const m = /(?:OWC|CT)-(\d+)/i.exec(node.packaging?.short ?? "")
  if (m) return Number(m[1])
  return node.packaging?.quantity && node.packaging.quantity > 0 ? node.packaging.quantity : 1
}

// Per-75cl-bottle price for a variant. `price` is per-bottle for `size` cl;
// only large-format bottles (magnums etc.) are scaled down to a 75cl basis.
function per75(node: GerstlNode): number | null {
  const price = node.price ?? 0
  const cl = node.size?.value ?? 0
  if (price <= 0 || cl <= 0) return null
  return cl === 75 ? price : price / (cl / 75)
}

// SKU shape: COUNTRY.<id>.<vintage>.<format>  e.g. FRA.267137.2025.F1
function skuBase(sku: string): string {
  return sku.split(".").slice(0, 3).join(".")
}

function toInt(s: string | undefined): number | null {
  if (!s) return null
  const n = parseInt(s, 10)
  return Number.isFinite(n) ? n : null
}

export const gerstl: SourceAdapter = {
  name: "gerstl",
  origin: "https://www.gerstl.ch",
  sitemapUrl: "https://www.gerstl.ch/sitemap.xml",

  isProductUrl(url: string): boolean {
    // Product pages end in "/p"; skip boxes/sets/gift cards by slug hint.
    if (!/\/p\/?$/.test(url)) return false
    if (/(degustations?-box|geschenk|gutschein|giftcard|-tbo-|-set-)/i.test(url)) return false
    return true
  },

  parse(url: string, html: string): CatalogWine | null {
    const state = extractNgState(html)
    if (!state) return null
    const nodes = collectProductNodes(state)
    if (!nodes.length) return null

    const urlSlug = new URL(url).pathname.replace(/^\/|\/p\/?$/g, "")
    const primary = nodes.find((n) => n.slug === urlSlug) ?? nodes[0]
    if (!primary.sku) return null

    const vintage = toInt(primary.year?.key ?? primary.year?.name ?? undefined)
    const wineType = mapWineType(primary.wineType?.name ?? primary.color?.name)

    // Find the best price among this wine's format variants.
    const base = skuBase(primary.sku)
    const family = nodes.filter((n) => n.sku && skuBase(n.sku) === base)

    // A 75cl variant's `price` is already the per-bottle retail price. Prefer
    // the smallest carton (buy-single = the honest single-bottle price) among
    // the 75cl variants.
    const singles = family
      .filter((n) => (n.size?.value ?? 0) === 75 && (n.price ?? 0) > 0)
      .sort((a, b) => cartonSize(a) - cartonSize(b))

    let marketPriceChf: number | null = null
    let priceBasis: CatalogWine["priceBasis"] = "single-bottle"
    let bottleSizeClRef = 75

    if (singles.length) {
      marketPriceChf = round2(singles[0].price!)
      priceBasis = "single-bottle"
      bottleSizeClRef = 75
    } else {
      // Derive from the smallest-format variant available.
      const derivable = family
        .map((n) => ({ n, p: per75(n) }))
        .filter((x): x is { n: GerstlNode; p: number } => x.p != null)
        .sort((a, b) => (a.n.size?.value ?? 0) - (b.n.size?.value ?? 0))
      if (derivable.length) {
        marketPriceChf = round2(derivable[0].p)
        priceBasis = "derived-per-bottle"
        bottleSizeClRef = derivable[0].n.size?.value ?? 0
      }
    }

    if (marketPriceChf == null) return null // no fake price — drop the row

    const name = [primary.title1, primary.title3].filter(Boolean).join(" ").trim()
    if (!name) return null
    const producer = primary.title1?.trim() || null

    const criticRatings: CriticRating[] = (primary.customRating ?? [])
      .filter((r) => r.author && r.rating)
      .map((r) => ({ author: String(r.author), rating: String(r.rating), of: Number(r.of) || 0 }))

    return {
      canonicalKey: canonicalKey(producer, name, vintage),
      name,
      producer,
      vintage,
      wineType,
      region: mapRegion(primary.country?.name, primary.region?.name, primary.subregion?.name),
      country: primary.country?.name ?? null,
      marketPriceChf,
      priceBasis,
      bottleSizeClRef,
      criticScore: parseCriticScore(criticRatings),
      criticRatings,
      sommelierNote: primary.teaser?.trim() || null,
      source: "gerstl",
      sourceUrl: url,
      sourceSku: primary.sku,
      subskription: isSubskription(primary.subskription),
      scrapedAt: new Date().toISOString(),
    }
  },
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function isSubskription(v: unknown): boolean {
  if (typeof v === "boolean") return v
  if (typeof v === "string") return /ja|true|1/i.test(v)
  if (v && typeof v === "object") {
    const key = (v as { key?: string }).key
    return key ? /ja|true|1|sub/i.test(key) : true
  }
  return false
}
