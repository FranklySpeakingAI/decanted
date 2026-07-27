# Decanted — Audit & Rebuild Spec

**Date:** 2026-07-27 · **Audience:** Claude Code (implementation) · **Author:** code audit of current `main` (fd9fc7f)

---

## Part 1 — Audit of the current app

### 1.1 What the app does today

Next.js 16 App Router app, single server action (`app/actions/processWineList.ts`). Two input modes:

- **File mode:** PDF/DOCX/XLSX → in-memory text extraction (`pdf-parse`, `mammoth`, `xlsx`).
- **URL mode:** fetches the page, then crawls for wine-list PDFs — up to 2 PDFs on the page, then up to 3 sub-pages × 2 PDFs each (2-hop discovery), else strips HTML.

Extracted text then runs a 3-layer pipeline in `lib/mockLLM.ts`:

1. **Layer 1** — regex pre-filter (free): keeps lines with a price or year, max 300 lines. Skipped for docs < 12k chars.
2. **Layer 2A** — extraction: `gpt-4o-mini` or `claude-haiku-4-5` parses lines → JSON (name, vintage, menuPrice, type, region). Capped at 150 wines.
3. **Layer 2B** — enrichment: `gpt-4o-mini` or **`claude-sonnet-4-6` with `max_tokens: 32000`** invents producer, market price, critic score, pairings, and a sommelier note for **every wine, on every scan**.

`lib/scoring.ts` computes markup factor and a value score client-agnostically; UI filters/ranks client-side.

### 1.2 Root causes of the cost explosion

These are the reasons "the money was basically drained after one search":

1. **Unbounded retry recursion on 429** (`mockLLM.ts:322–326` and `381–385`). When Anthropic returns 429 (rate limit / low balance behaves similarly with overload), the code recursively calls itself with **no retry cap and no backoff ceiling**. A sustained 429 = infinite paid retry loop. This is the single worst bug.
2. **Everything is recomputed on every scan.** No caching of any kind. Scan the same wine list twice → pay the full pipeline twice. Two users at the same restaurant → double cost. Nothing is ever persisted.
3. **The expensive model does the bulk work.** Enrichment sends up to 150 wines + a ~1.5k-token region taxonomy to Sonnet with a 32k output budget. At Sonnet output pricing that is up to roughly CHF 0.40–0.50 of output tokens per scan *before* retries — and it's asked to generate market data it cannot actually know (see 1.3).
4. **URL mode amplifies input.** The 2-hop crawler can pull several large PDFs (up to 100 pages each) in one request; 40k chars (~10k tokens) go into the pipeline per scan.
5. **No spend guardrails.** No budget cap, no auth, and the per-IP rate limiter (10/hr) is an in-memory `Map` — it resets on every deploy/cold start and is per-instance, so on Vercel it is effectively decorative. IP comes from spoofable `x-forwarded-for`.

### 1.3 Quality problems (why results weren't trustworthy)

- **Market prices are hallucinated.** `estimatedMarketPrice` comes from the model's memory, not any price source. The entire value ranking is built on invented numbers.
- **Silent fake defaults.** If enrichment fails or a field is missing: `criticScore` → 85, `marketPrice` → `menuPrice / 2.5` (`mockLLM.ts:441–464`, `scoring.ts:64`). A markup of exactly 2.5× is scored "green / ideal" — so a failed enrichment produces confident-looking but meaningless "good value" results.
- **Truncation risk.** 150 wines × full enriched JSON can exceed the output budget; a truncated response fails `JSON.parse` → silently falls back to the fake defaults above.
- **No OCR.** Image-only PDFs (very common for restaurant lists) are rejected.
- **Vintage ignored in pricing.** Same wine, any vintage → same estimate.

### 1.4 Security / robustness findings

- **SSRF:** URL mode fetches arbitrary user-supplied URLs server-side with no private-IP/localhost blocklist (`processWineList.ts:78`, and again in the crawler). Should resolve DNS and block RFC-1918/link-local/metadata ranges.
- **Anyone can spend your money:** no auth on the server action; rate limiter ineffective (above).
- **`pdf-parse` v1** is unmaintained (last release 2019); fine for a prototype, should be replaced (`pdfjs-dist` or `unpdf`).
- Rate-limit `Map` never evicts expired entries (slow leak; minor).
- Good things worth keeping: magic-byte file validation, in-memory-only file handling, CSP + security headers, origin check on POST, honest error surfaces in most places.

### 1.5 What's worth keeping

The UI layer is in good shape: `WineFinder`, filter bars, `TopPicksSection`, `WineCard`, the scoring display, theme system. The file validation (`validators.ts`) and text extraction functions are reusable. The region taxonomy is a solid starting vocabulary. The scoring formula is reasonable *once fed real numbers*. Keep all of it; replace the pipeline.

---

## Part 2 — Rebuild spec

### 2.1 Decisions (confirmed with David)

- **Market prices:** LLM-estimate **once per wine**, persist in Supabase, serve from DB thereafter (write-through cache). No scraping.
- **Scope:** Switzerland only — CHF only, Swiss market price estimates, Swiss-weighted region taxonomy.
- **Stack:** keep Next.js + Vercel, add Supabase (Postgres + Auth).
- **Cost control:** hard daily spend cap tracked in DB **and** Supabase Auth login required to scan.

### 2.2 Cost model — why this fixes it

The insight: a restaurant wine list is ~90% wines that other lists also carry. Enrichment cost should be paid **once per wine ever**, not once per wine per scan.

- Scan #1 of a 100-wine list: ~100 wines enriched by **Haiku** (not Sonnet), batched → a few rappen.
- Scan #2 of the same list (any user): 100% DB hits → **zero LLM enrichment cost**; only the cheap extraction call runs.
- Any other Swiss restaurant: typically 60–90% DB hits after modest usage.
- Same-document re-scan: SHA-256 hash of extracted text → return stored result, **zero API calls**.

Per-scan worst case (cold DB, 150 wines): 1 Haiku extraction call (~10k in / 4k out) + ~8 Haiku enrichment batches — order of CHF 0.05. Warm: ~CHF 0.01. The daily cap makes even bugs bounded.

### 2.3 Supabase schema

```sql
-- Canonical wine catalog (grows forever, one row per wine+vintage)
create table wines (
  id uuid primary key default gen_random_uuid(),
  canonical_key text unique not null,        -- normalized "producer|name|vintage"
  name text not null,
  producer text,
  vintage int,                               -- null = NV
  wine_type text not null check (wine_type in
    ('Red','White','Rosé','Champagne','Sparkling','Dessert','Non-Alcoholic')),
  region text not null default 'Other',      -- canonical taxonomy key
  country text,
  market_price_chf numeric,                  -- Swiss retail estimate
  price_confidence text check (price_confidence in ('estimated','verified')),
  critic_score int check (critic_score between 80 and 100),
  food_pairings text[] default '{}',
  sommelier_note text,
  enriched_at timestamptz,
  enrichment_model text,                     -- audit which model produced the estimate
  created_at timestamptz default now()
);
create index wines_trgm on wines using gin (name gin_trgm_ops);      -- requires pg_trgm
create index wines_producer_trgm on wines using gin (producer gin_trgm_ops);

-- Scan cache: same document → same result, no API calls
create table scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  content_hash text not null,                -- sha256 of normalized extracted text
  source_type text check (source_type in ('file','url')),
  source_ref text,                           -- filename or URL (no file contents stored)
  wine_count int,
  created_at timestamptz default now()
);
create index scans_hash on scans (content_hash);

-- Line items: restaurant price per wine per scan (this is the data moat)
create table scan_wines (
  scan_id uuid references scans on delete cascade,
  wine_id uuid references wines,
  restaurant_price_chf numeric not null,
  raw_line text,                             -- original extracted text, for debugging matches
  primary key (scan_id, wine_id)
);

-- Spend ledger for the hard daily cap
create table api_usage (
  id bigint generated always as identity primary key,
  day date not null default current_date,
  model text not null,
  input_tokens int not null,
  output_tokens int not null,
  estimated_cost_chf numeric not null,
  user_id uuid references auth.users,
  created_at timestamptz default now()
);
create index api_usage_day on api_usage (day);
```

RLS: `wines` readable by authenticated users, writable only by service role. `scans`/`scan_wines` readable by owning user. `api_usage` service-role only.

### 2.4 New pipeline

```
input (file/URL)
  → extract text (keep existing extractors; swap pdf-parse → unpdf)
  → sha256(normalized text) — hit in `scans`? → return stored result (0 API calls)
  → regex pre-filter (keep Layer 1 as-is)
  → EXTRACTION: one Haiku call → [{name, producer?, vintage, menuPrice, type, region}]
  → NORMALIZE: canonical_key = slug(producer)|slug(name)|vintage
  → DB MATCH per wine:
      1. exact canonical_key
      2. pg_trgm similarity(name) > 0.55 AND vintage matches (or both NV)
      → hit: use stored enrichment (free)
      → miss: queue for enrichment
  → ENRICH misses only: Haiku, batches of ~20 wines, max_tokens 4000/batch,
      prompt asks for SWISS retail price (CHF, as sold at Coop/Denner/Flaschenpost level)
      → upsert into `wines` (price_confidence = 'estimated')
  → score with existing scoring.ts, store scan + scan_wines, return
```

Hard rules for every LLM call:

- **Max 2 retries, exponential backoff, then fail loudly.** Never recurse unbounded. This replaces `mockLLM.ts:322–326/381–385`.
- **Before each call:** check `sum(api_usage.estimated_cost_chf) where day = today` against `DAILY_BUDGET_CHF` env var. Over budget → refuse scan with a clear message.
- **After each call:** insert actual token usage into `api_usage` (both providers return usage in the response).
- **No Sonnet anywhere in the hot path.** Haiku is sufficient for both steps; taxonomy prompt stays under 1.5k tokens and should use prompt caching (`cache_control` on the system block) since it's identical across calls.
- **No fake defaults.** If enrichment fails for a wine, mark it "no market data" in the UI rather than inventing `price/2.5` and 85 points. Remove the silent fallbacks in `mapEnrichedWine` and `scoreWine`.

### 2.5 Switzerland-only constraints

- Currency fixed to CHF; drop currency detection.
- Enrichment prompt anchored to Swiss retail (mention Coop Mondovino / Denner / Flaschenpost price level as the reference frame; do not scrape them).
- Keep the Swiss 3-column price-format rules from the current extraction prompt (they were hard-won — see git log `f41b77f`).
- Expand Swiss regions in taxonomy (add Ticino, Graubünden, Zürich, Schaffhausen, Thurgau, Aargau to the existing Vaud/Valais/Geneva/Neuchâtel).
- URL mode: keep, but add SSRF blocklist (private/link-local/metadata IPs after DNS resolution), reduce crawl to 1 hop, and only fetch `.ch`-plausible content sizes (cap PDF download at 10 MB, 30 pages).

### 2.6 Auth & abuse control

- Supabase Auth, magic-link email (no password UX needed). Server action verifies session before doing anything.
- Per-user rate limit stored in Postgres (e.g. 10 scans/day/user), replacing the in-memory Map.
- Keep origin check + security headers from `proxy.ts` as-is.

### 2.7 Build order (suggested phases)

1. **Supabase setup:** project, `pg_trgm` extension, schema above, RLS, generated TS types.
2. **Kill the bleed:** retry cap + budget check + usage ledger around existing calls. (Smallest diff, biggest win — do this even before the rest.)
3. **Auth:** magic-link gate on the scan action.
4. **Cache layers:** scan-hash short-circuit, then DB match + enrich-misses-only, Haiku everywhere, prompt caching.
5. **Cleanup:** remove mock dataset & OpenAI branch (pick one provider), remove fake defaults, swap pdf-parse → unpdf, SSRF blocklist.
6. **UI polish:** "no market data" state on WineCard, DB-hit-rate indicator (nice for validating the cache is working).

Out of scope for v2 (park for later): OCR for image-only PDFs (Claude vision on page images would fit the same pipeline), price verification against real retailer data, user taste profiles.

### 2.8 Acceptance checks

- Scanning the same PDF twice makes **zero** LLM calls the second time.
- A 429 from the API results in at most 2 retries, then a user-visible error.
- With `DAILY_BUDGET_CHF=1`, the app refuses scans after ~CHF 1 of usage and says so.
- A wine present in `wines` is never re-enriched.
- No wine ever displays a score/market price that came from a hardcoded default.
- `http://169.254.169.254/` and `http://localhost:3000` as URL inputs are rejected.
