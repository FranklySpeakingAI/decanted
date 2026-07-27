// Sitemap reader. Handles both <sitemapindex> (nested) and <urlset> forms.
// Uses the PoliteFetcher so sitemap fetches are throttled and robots-checked
// like everything else. XML is simple enough here to extract <loc> by regex.

import type { PoliteFetcher } from "./fetcher"

function extractLocs(xml: string): string[] {
  const locs: string[] = []
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) locs.push(decodeXmlEntities(m[1]))
  return locs
}

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

// Given a sitemap URL, return the flat list of product URLs matching `keep`.
// Recurses one level into a sitemap index. Note: a sitemap index and its child
// sitemaps may live on a different host (e.g. a CDN); those are fetched with a
// plain throttled request but still identify as DecantedBot.
export async function collectProductUrls(
  fetcher: PoliteFetcher,
  sitemapUrl: string,
  keep: (url: string) => boolean,
): Promise<string[]> {
  const xml = await fetchMaybeCrossHost(fetcher, sitemapUrl)
  if (!xml) return []

  const isIndex = /<sitemapindex[\s>]/i.test(xml)
  if (isIndex) {
    const childSitemaps = extractLocs(xml)
    const out: string[] = []
    for (const child of childSitemaps) {
      // Only descend into product sitemaps when the filename hints at it, to
      // avoid pulling category/page sitemaps we'd discard anyway.
      if (/product|artikel|wein|wine/i.test(child) || childSitemaps.length <= 3) {
        const childXml = await fetchMaybeCrossHost(fetcher, child)
        if (childXml) out.push(...extractLocs(childXml).filter(keep))
      }
    }
    return out
  }

  return extractLocs(xml).filter(keep)
}

// Sitemaps are sometimes served from a CDN host that differs from the site
// origin. The PoliteFetcher is origin-locked (correctly, for the crawl itself),
// so for same-origin we use it; for a CDN sitemap we do a single throttled,
// identified GET. Product PAGES always go through the origin-locked fetcher.
import { USER_AGENT, REQUEST_TIMEOUT_MS } from "./config"
async function fetchMaybeCrossHost(fetcher: PoliteFetcher, url: string): Promise<string | null> {
  try {
    if (new URL(url).origin === fetcher.origin) return await fetcher.get(url)
  } catch {
    return null
  }
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!res.ok) {
    console.warn(`[sitemap] ${res.status} for ${url}`)
    return null
  }
  return res.text()
}
