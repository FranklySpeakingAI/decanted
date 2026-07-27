// Polite, single-host HTTP fetcher.
//
// - Identifies itself with USER_AGENT.
// - Serialises requests to one host with a minimum inter-request delay
//   (honouring robots Crawl-delay).
// - Bounded retries with backoff on transient errors — never unbounded.
// - Respects the host's robots policy on every URL before fetching.

import {
  USER_AGENT,
  REQUEST_TIMEOUT_MS,
  MAX_RETRIES,
  RETRY_BASE_MS,
} from "./config"
import { fetchRobots, type RobotsPolicy } from "./robots"

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export class PoliteFetcher {
  private robots!: RobotsPolicy
  private lastFetchAt = 0
  readonly origin: string

  private constructor(origin: string) {
    this.origin = origin
  }

  // Async factory: loads robots.txt up front (throws if it can't, = don't crawl).
  static async create(origin: string): Promise<PoliteFetcher> {
    const f = new PoliteFetcher(origin)
    f.robots = await fetchRobots(origin)
    console.log(`[fetcher] ${origin} robots loaded — crawl-delay ${f.robots.crawlDelayMs}ms`)
    return f
  }

  isAllowed(url: string): boolean {
    try {
      const u = new URL(url)
      if (u.origin !== this.origin) return false
      return this.robots.isAllowed(u.pathname + u.search)
    } catch {
      return false
    }
  }

  private async throttle() {
    const wait = this.lastFetchAt + this.robots.crawlDelayMs - Date.now()
    if (wait > 0) await sleep(wait)
    this.lastFetchAt = Date.now()
  }

  // Fetch text for a URL. Returns null if robots-disallowed. Throws after
  // exhausting retries.
  async get(url: string): Promise<string | null> {
    if (!this.isAllowed(url)) {
      console.warn(`[fetcher] robots-disallowed, skipping: ${url}`)
      return null
    }

    let attempt = 0
    for (;;) {
      await this.throttle()
      try {
        const res = await fetch(url, {
          headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml,application/xml" },
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        })
        if (res.status === 429 || res.status >= 500) {
          throw new Error(`HTTP ${res.status}`)
        }
        if (!res.ok) {
          // 4xx (not 429) is not retryable — the page is simply gone/forbidden.
          console.warn(`[fetcher] ${res.status} ${url} — skipping`)
          return null
        }
        return await res.text()
      } catch (err) {
        attempt++
        const msg = err instanceof Error ? err.message : String(err)
        if (attempt > MAX_RETRIES) {
          throw new Error(`giving up on ${url} after ${MAX_RETRIES} retries: ${msg}`)
        }
        const backoff = RETRY_BASE_MS * 2 ** (attempt - 1)
        console.warn(`[fetcher] ${msg} on ${url} — retry ${attempt}/${MAX_RETRIES} in ${backoff}ms`)
        await sleep(backoff)
      }
    }
  }
}
