# Prefill crawler

One-off, supervised backfill of the `wines` catalogue from Swiss wine
retailers that **permit** crawling. Fills the DB with real Swiss retail prices
(and real critic scores) so the runtime pipeline gets cache hits — and honest
market prices — from day one, instead of paying an LLM to invent numbers on
every scan.

This is a **backfill tool, not a runtime dependency.** It never runs in the
request path. It writes JSONL to `data/prefill/`; a separate loader upserts that
into Supabase once the schema exists (Phase 3.5).

## Politeness contract

We only crawl what a retailer's `robots.txt` allows, and we do it as a good
web citizen:

- **Honest identity.** Every request sends a descriptive `User-Agent` with a
  contact address (`scripts/prefill/config.ts`). We are not hiding.
- **robots.txt is obeyed.** `robots.ts` fetches and enforces the host's rules
  before any page is fetched. If `robots.txt` can't be loaded, we **refuse to
  crawl that host** — the safe default is "don't", not "assume yes".
- **Throttled.** One request at a time per host, ≥2.5s apart (more if the host
  asks via `Crawl-delay`). A full ~1,100-page catalogue therefore takes ~45+
  minutes, on purpose.
- **Bounded.** `MAX_PAGES_PER_SOURCE` caps each run; retries are capped at 2
  with backoff (never the unbounded-recursion bug from the old pipeline).
- **Structured data first.** We read each retailer's own machine-readable
  payload (Gerstl: Angular `ng-state` JSON) rather than screen-scraping.

If a retailer objects or their terms disallow it, remove them from
`ENABLED_SOURCES` and delete their adapter. The licensed alternative to
crawling is the Wine-Searcher API.

## Sources

| Source   | robots            | Data form                | Notes                        |
| -------- | ----------------- | ------------------------ | ---------------------------- |
| `gerstl` | permits `/…/p`    | Angular `ng-state` JSON  | Real critic scores, CHF, en-primeur flagged |

Mondovino (Coop) and Denner were evaluated and **dropped**: their sites return
403 to automated requests / sit behind bot protection, i.e. they do not permit
this. We don't try to defeat that.

## Usage

```bash
# Smoke test — fetch a few pages, print samples, write nothing:
npx tsx scripts/prefill/run.ts --source gerstl --limit 5 --dry

# Real backfill — writes data/prefill/gerstl.jsonl + manifest:
PREFILL_MAX_PAGES=1200 npx tsx scripts/prefill/run.ts --source gerstl
```

Flags / env:

- `--source <name>` — one adapter (default: all in `ENABLED_SOURCES`).
- `--limit <n>` / `PREFILL_MAX_PAGES` — page cap per source.
- `--dry` — parse and report, write nothing.
- `PREFILL_SOURCES=gerstl,other` — which adapters are enabled.

## Output

`data/prefill/<source>.jsonl` — one `CatalogWine` (see `types.ts`) per line:
canonical key, name/producer/vintage, mapped region + wine type, **75cl
bottle price in CHF** (`priceBasis` flags single-bottle vs derived), critic
score (median of /100 critics, or `null` — never a fake default), and full
provenance. `<source>.manifest.json` records counts and a sample of errors.

## Next step (Phase 3.5)

`load-to-supabase.ts` (to be written once the `wines` table exists) reads the
JSONL and upserts on `canonical_key` with `price_confidence = 'verified'` and
`enrichment_model = 'retailer:<source>'`. Food pairings stay empty here; those
get filled by the cheap offline Haiku enrichment pass, paid once per wine.
