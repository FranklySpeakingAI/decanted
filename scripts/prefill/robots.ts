// Minimal, correct-enough robots.txt fetcher + matcher.
//
// Supports: User-agent groups (falls back to `*`), Allow / Disallow with `*`
// wildcards and `$` end-anchors, longest-match-wins precedence (per the de-facto
// standard), and Crawl-delay. This is intentionally small — we only need to
// answer "may DecantedBot fetch this URL, and how slowly".

import { USER_AGENT, DEFAULT_CRAWL_DELAY_MS, REQUEST_TIMEOUT_MS } from "./config"

interface Rule {
  allow: boolean
  pattern: string
}

export interface RobotsPolicy {
  isAllowed(pathname: string): boolean
  crawlDelayMs: number
}

// Turn a robots pattern into a RegExp. `*` → `.*`, `$` at end → anchor.
function patternToRegExp(pattern: string): RegExp {
  let p = pattern
  const anchored = p.endsWith("$")
  if (anchored) p = p.slice(0, -1)
  const escaped = p
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&") // escape regex metachars
    .replace(/\*/g, ".*") // robots wildcard
  return new RegExp("^" + escaped + (anchored ? "$" : ""))
}

function uaToken(): string {
  // The product token before the first space/slash, lowercased: "decantedbot".
  return USER_AGENT.split(/[/ ]/)[0].toLowerCase()
}

// Parse robots.txt text into a policy for our user-agent.
export function parseRobots(text: string): RobotsPolicy {
  const lines = text.split(/\r?\n/)
  const groups: { agents: string[]; rules: Rule[]; delay?: number }[] = []
  let current: { agents: string[]; rules: Rule[]; delay?: number } | null = null
  let lastWasAgent = false

  for (const raw of lines) {
    const line = raw.replace(/#.*$/, "").trim()
    if (!line) continue
    const idx = line.indexOf(":")
    if (idx === -1) continue
    const field = line.slice(0, idx).trim().toLowerCase()
    const value = line.slice(idx + 1).trim()

    if (field === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] }
        groups.push(current)
      }
      current.agents.push(value.toLowerCase())
      lastWasAgent = true
      continue
    }
    lastWasAgent = false
    if (!current) continue
    if (field === "disallow") current.rules.push({ allow: false, pattern: value })
    else if (field === "allow") current.rules.push({ allow: true, pattern: value })
    else if (field === "crawl-delay") {
      const n = Number(value)
      if (!Number.isNaN(n)) current.delay = n
    }
  }

  // Select the most specific matching group: our token beats `*`.
  const me = uaToken()
  const specific = groups.find((g) => g.agents.some((a) => me.includes(a) && a !== "*"))
  const wildcard = groups.find((g) => g.agents.includes("*"))
  const group = specific ?? wildcard

  const rules = group?.rules ?? []
  const compiled = rules
    .filter((r) => r.pattern !== "") // empty Disallow = allow all; skip
    .map((r) => ({ allow: r.allow, re: patternToRegExp(r.pattern), len: r.pattern.length }))

  const crawlDelayMs = group?.delay ? Math.max(group.delay * 1000, DEFAULT_CRAWL_DELAY_MS) : DEFAULT_CRAWL_DELAY_MS

  return {
    crawlDelayMs,
    isAllowed(pathname: string): boolean {
      // Longest matching pattern wins; tie → Allow wins.
      let best: { allow: boolean; len: number } | null = null
      for (const r of compiled) {
        if (r.re.test(pathname)) {
          if (!best || r.len > best.len || (r.len === best.len && r.allow)) {
            best = { allow: r.allow, len: r.len }
          }
        }
      }
      return best ? best.allow : true
    },
  }
}

// Fetch and parse a host's robots.txt. On any failure we DEFAULT TO DENY the
// crawl for that host — the polite failure mode is to not crawl, not to assume
// permission.
export async function fetchRobots(origin: string): Promise<RobotsPolicy> {
  const url = new URL("/robots.txt", origin).href
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!res.ok) {
    throw new Error(`robots.txt ${res.status} for ${origin} — refusing to crawl`)
  }
  return parseRobots(await res.text())
}
