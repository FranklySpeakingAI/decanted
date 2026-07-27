// Normalisation helpers shared by all source adapters: canonical keys, region
// mapping onto the app taxonomy, wine-type mapping, and critic-score parsing.

import type { CriticRating, WineType } from "./types"

// Diacritic-insensitive slug for matching. Keeps digits.
export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

// canonical_key = slug(producer)|slug(name)|vintage  (matches wines table)
export function canonicalKey(producer: string | null, name: string, vintage: number | null): string {
  return `${slugify(producer ?? "")}|${slugify(name)}|${vintage ?? "nv"}`
}

// ── Wine type ───────────────────────────────────────────────────────────────
// Maps retailer colour/type labels (German-first, Gerstl) onto our enum.
export function mapWineType(raw: string | null | undefined): WineType {
  const s = (raw ?? "").toLowerCase()
  if (/schaum|champagne|prosecco|sekt|crémant|cremant|cava|spuman|mousseux/.test(s)) {
    return /champagne/.test(s) ? "Champagne" : "Sparkling"
  }
  if (/rosé|rose|rosato|rosado/.test(s)) return "Rosé"
  if (/weiss|weiß|white|blanc|bianco|blanco/.test(s)) return "White"
  if (/süss|suess|dessert|doux|dolce|sauternes|port|sherry|likör|likor/.test(s)) return "Dessert"
  if (/alkoholfrei|non.?alco/.test(s)) return "Non-Alcoholic"
  if (/rot|red|rouge|rosso|tinto/.test(s)) return "Red"
  return "Red"
}

// ── Region taxonomy ───────────────────────────────────────────────────────
// Canonical keys mirror lib/scoring.ts WineRegion, with the Switzerland-only
// expansion from the rebuild spec §2.5. Mapping is keyed on lowercased
// retailer region/subregion names (German-first).
const REGION_MAP: Record<string, string> = {
  // France
  bordeaux: "Bordeaux",
  burgund: "Burgundy",
  burgundy: "Burgundy",
  bourgogne: "Burgundy",
  champagne: "Champagne",
  rhône: "Rhône",
  rhone: "Rhône",
  elsass: "Alsace",
  alsace: "Alsace",
  loire: "Loire",
  languedoc: "Languedoc",
  "languedoc-roussillon": "Languedoc",
  roussillon: "Languedoc",
  provence: "Provence",
  jura: "Jura",
  beaujolais: "Beaujolais",
  südwesten: "Southwest France",
  sudwest: "Southwest France",
  // Italy
  toskana: "Tuscany",
  toscana: "Tuscany",
  tuscany: "Tuscany",
  piemont: "Piedmont",
  piedmont: "Piedmont",
  venetien: "Veneto",
  veneto: "Veneto",
  sizilien: "Sicily",
  sicilia: "Sicily",
  sicily: "Sicily",
  // Spain
  rioja: "Rioja",
  "ribera del duero": "Ribera del Duero",
  priorat: "Priorat",
  // Germany / Austria
  deutschland: "Germany",
  germany: "Germany",
  österreich: "Austria",
  osterreich: "Austria",
  austria: "Austria",
  // New world
  napa: "Napa Valley",
  "napa valley": "Napa Valley",
  sonoma: "Sonoma",
  argentinien: "Argentina",
  argentina: "Argentina",
  chile: "Chile",
  australien: "Australia",
  australia: "Australia",
  neuseeland: "New Zealand",
  "new zealand": "New Zealand",
  südafrika: "South Africa",
  sudafrika: "South Africa",
  "south africa": "South Africa",
}

// Swiss cantons/regions → expanded Swiss taxonomy keys (spec §2.5).
const SWISS_MAP: Record<string, string> = {
  waadt: "Swiss — Vaud",
  vaud: "Swiss — Vaud",
  lavaux: "Swiss — Vaud",
  "la côte": "Swiss — Vaud",
  chablais: "Swiss — Vaud",
  wallis: "Swiss — Valais",
  valais: "Swiss — Valais",
  genf: "Swiss — Geneva",
  genève: "Swiss — Geneva",
  geneva: "Swiss — Geneva",
  neuenburg: "Swiss — Neuchâtel",
  neuchâtel: "Swiss — Neuchâtel",
  tessin: "Swiss — Ticino",
  ticino: "Swiss — Ticino",
  graubünden: "Swiss — Graubünden",
  graubunden: "Swiss — Graubünden",
  grisons: "Swiss — Graubünden",
  zürich: "Swiss — Zürich",
  zurich: "Swiss — Zürich",
  schaffhausen: "Swiss — Schaffhausen",
  thurgau: "Swiss — Thurgau",
  aargau: "Swiss — Aargau",
}

const SWISS_COUNTRY = /schweiz|switzerland|suisse|svizzera/i

export function mapRegion(
  country: string | null | undefined,
  region: string | null | undefined,
  subregion?: string | null,
): string {
  if (country && SWISS_COUNTRY.test(country)) {
    for (const label of [subregion, region]) {
      const hit = label && SWISS_MAP[label.toLowerCase().trim()]
      if (hit) return hit
    }
    return "Swiss — Vaud" // fallback bucket for unmapped Swiss regions
  }
  for (const label of [region, subregion]) {
    const hit = label && REGION_MAP[label.toLowerCase().trim()]
    if (hit) return hit
  }
  return "Other"
}

// ── Critic score ────────────────────────────────────────────────────────────
// Collapse a set of critic ratings to a single 80–100 int. Only ratings on a
// /100 scale count; ranges ("96-98") take their midpoint; we use the MEDIAN so
// one generous critic can't skew it. Returns null (never a fake default) when
// there's no usable /100 rating, and null if the median lands below the
// schema's 80 floor.
export function parseCriticScore(ratings: CriticRating[]): number | null {
  const vals: number[] = []
  for (const r of ratings) {
    if (Number(r.of) !== 100) continue
    const nums = String(r.rating).match(/\d{2,3}(?:\.\d)?/g)
    if (!nums) continue
    const parsed = nums.map(Number).filter((n) => n >= 50 && n <= 100)
    if (!parsed.length) continue
    vals.push(parsed.reduce((a, b) => a + b, 0) / parsed.length) // midpoint of a range
  }
  if (!vals.length) return null
  vals.sort((a, b) => a - b)
  const mid = vals.length % 2 ? vals[(vals.length - 1) / 2] : (vals[vals.length / 2 - 1] + vals[vals.length / 2]) / 2
  const score = Math.round(mid)
  return score >= 80 ? Math.min(100, score) : null
}
