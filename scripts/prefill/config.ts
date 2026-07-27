// Prefill crawler configuration.
//
// POLITENESS CONTRACT (see README.md): we identify ourselves honestly, obey
// robots.txt, throttle hard, and cap total pages. These defaults are
// deliberately conservative — a full catalogue crawl should be a deliberate,
// supervised act, not something that runs fast or by accident.

export const USER_AGENT =
  "DecantedBot/1.0 (+https://decanted.ch; Swiss wine price catalogue; contact david@frankly-speaking.ch)"

// Minimum delay between requests to the SAME host, in ms. Overridden upward
// (never downward) by a Crawl-delay directive in the host's robots.txt.
export const DEFAULT_CRAWL_DELAY_MS = 2_500

// Per-request network timeout.
export const REQUEST_TIMEOUT_MS = 20_000

// Hard ceiling on product pages fetched per source per run. The full Gerstl
// catalogue is ~1,100; keep this low while developing and raise it
// deliberately for a real backfill.
export const MAX_PAGES_PER_SOURCE = Number(process.env.PREFILL_MAX_PAGES ?? 25)

// Retry policy for transient failures (network / 5xx / 429). Never unbounded.
export const MAX_RETRIES = 2
export const RETRY_BASE_MS = 1_000

// Where JSONL output + run manifests are written.
export const OUTPUT_DIR = "data/prefill"

// Registered sources. Add adapters here; `run.ts` iterates this list.
export const ENABLED_SOURCES = (process.env.PREFILL_SOURCES ?? "gerstl")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean)
