"use server"

import { headers } from "next/headers"
import { validateFile, friendlyValidationError } from "@/lib/validators"
import { getLLMResponse } from "@/lib/mockLLM"
import { scoreAndRankWines, type ProcessResult } from "@/lib/scoring"
import { ERRORS, DEFAULT_CURRENCY, WINE_LIST_KEYWORDS } from "@/lib/constants"

// ---------------------------------------------------------------------------
// Per-process rate limiter (10 req / IP / hour).
// NOTE: This is single-instance only. For multi-region Vercel deployments,
//       replace with Vercel KV: https://vercel.com/docs/storage/vercel-kv
// ---------------------------------------------------------------------------
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_MAX = 10
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitStore.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return false
  }
  if (entry.count >= RATE_LIMIT_MAX) return true
  entry.count++
  return false
}

function getClientIP(h: Awaited<ReturnType<typeof headers>>): string {
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    "unknown"
  )
}

// ---------------------------------------------------------------------------
// Main server action
// ---------------------------------------------------------------------------
export async function processWineList(formData: FormData): Promise<ProcessResult> {
  try {
    const h = await headers()
    if (isRateLimited(getClientIP(h))) {
      return { success: false, error: ERRORS.rateLimit }
    }

    const mode = formData.get("mode") as string | null
    if (mode === "url") return processURL(formData)
    if (mode === "file") return processFile(formData)
    return { success: false, error: ERRORS.invalidRequest }
  } catch (err) {
    console.error("[processWineList]", err instanceof Error ? err.message : err)
    return { success: false, error: ERRORS.generic }
  }
}

// ---------------------------------------------------------------------------
// URL mode
// ---------------------------------------------------------------------------
async function processURL(formData: FormData): Promise<ProcessResult> {
  const raw = (formData.get("url") as string | null) ?? ""
  if (!raw || raw.length > 2048) return { success: false, error: ERRORS.urlRequired }

  let parsed: URL
  try { parsed = new URL(raw) } catch {
    return { success: false, error: ERRORS.urlRequired }
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return { success: false, error: ERRORS.urlProtocol }
  }

  let content = ""
  let isHTML = false
  try {
    const res = await fetch(raw, {
      headers: { "User-Agent": "DecantedBot/1.0 (+https://decanted.vercel.app)" },
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) return { success: false, error: ERRORS.urlUnreachable }

    const contentType = res.headers.get("content-type") ?? ""
    const isPDF = contentType.includes("application/pdf") ||
                  parsed.pathname.toLowerCase().endsWith(".pdf")

    if (isPDF) {
      // Binary PDF at a URL — pipe through pdf-parse, same as file upload
      const buf = Buffer.from(await res.arrayBuffer())
      try {
        content = await extractPDF(buf)
        console.log(`[extractTextContent] PDF from URL: ${content.length} chars`)
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : "Could not read that PDF.",
        }
      }
    } else {
      isHTML = true
      const rawHtml = await res.text()
      const { pdfs, pages } = extractLinksFromHTML(rawHtml, raw)

      // Step 1: try wine-scored PDFs linked directly on this page
      for (const { url: pdfUrl, score } of pdfs.slice(0, 2)) {
        if (score < 2) break
        const text = await tryFetchPDF(pdfUrl)
        if (text) {
          content = text
          isHTML = false
          console.log(`[URL scan] Wine PDF on page: ${pdfUrl} — ${text.length} chars`)
          break
        }
      }

      // Step 2: follow wine-flagged sub-pages and try their PDFs
      if (isHTML) {
        for (const { url: pageUrl, score } of pages.slice(0, 3)) {
          if (score < 2) break
          try {
            const subRes = await fetch(pageUrl, {
              headers: { "User-Agent": "DecantedBot/1.0 (+https://decanted.vercel.app)" },
              signal: AbortSignal.timeout(8_000),
            })
            if (!subRes.ok) continue
            const { pdfs: subPDFs } = extractLinksFromHTML(await subRes.text(), pageUrl)
            for (const { url: pdfUrl } of subPDFs.slice(0, 2)) {
              const text = await tryFetchPDF(pdfUrl)
              if (text) {
                content = text
                isHTML = false
                console.log(`[URL scan] PDF via sub-page ${pageUrl}: ${pdfUrl} — ${text.length} chars`)
                break
              }
            }
            if (!isHTML) break
          } catch { continue }
        }
      }

      // Step 3: fall back to stripped HTML text
      if (isHTML) {
        const rawText = stripHTML(rawHtml)
        content = rawText.slice(0, 40_000)
        console.log(`[extractTextContent] HTML from URL: ${rawText.length} chars raw → ${content.length} sent`)
      }
    }
  } catch {
    return { success: false, error: ERRORS.urlUnreachable }
  }

  try {
    const rawWines = await getLLMResponse({ mode: "url", content })
    const wines = scoreAndRankWines(rawWines)
    return { success: true, wines, currency: wines[0]?.currency ?? DEFAULT_CURRENCY }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "LLM call failed"
    console.error("[processURL] LLM error:", msg)
    if (isHTML && msg.includes("Could not parse any wines")) {
      return { success: false, error: ERRORS.noWineListFound }
    }
    return { success: false, error: msg }
  }
}

// ---------------------------------------------------------------------------
// File mode
// ---------------------------------------------------------------------------
async function processFile(formData: FormData): Promise<ProcessResult> {
  const file = formData.get("file") as File | null
  if (!file) return { success: false, error: ERRORS.noFile }

  const validation = await validateFile(file)
  if (!validation.valid) {
    return {
      success: false,
      error: friendlyValidationError(validation.error ?? "unsupported_type"),
    }
  }

  // Read entirely into memory — never written to disk, never stored
  const buffer = await file.arrayBuffer()

  let content: string
  try {
    content = await extractTextContent(file.type, buffer)
  } catch (err) {
    console.error("[extractTextContent]", err instanceof Error ? err.message : err)
    return { success: false, error: ERRORS.fileUnreadable }
  }

  if (!content.trim()) {
    return { success: false, error: ERRORS.fileEmpty }
  }

  console.log(`[extractTextContent] Extracted ${content.length} characters from file`)
  try {
    const rawWines = await getLLMResponse({ mode: "file", content })
    const wines = scoreAndRankWines(rawWines)
    return { success: true, wines, currency: wines[0]?.currency ?? DEFAULT_CURRENCY }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "LLM call failed"
    console.error("[processFile] LLM error:", msg)
    return { success: false, error: msg }
  }
}

// ---------------------------------------------------------------------------
// Text extraction — in-memory, no filesystem writes
// ---------------------------------------------------------------------------
async function extractTextContent(
  mimeType: string,
  buffer: ArrayBuffer,
): Promise<string> {
  const nodeBuffer = Buffer.from(buffer)

  if (mimeType === "application/pdf") {
    return extractPDF(nodeBuffer)
  }

  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return extractDOCX(nodeBuffer)
  }

  if (
    mimeType ===
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    return extractXLSX(nodeBuffer)
  }

  throw new Error(`Unsupported MIME type: ${mimeType}`)
}

async function extractPDF(buf: Buffer): Promise<string> {
  // Import from the lib path to bypass the test-file loading in pdf-parse's index.js.
  // This is the canonical Next.js workaround for pdf-parse v1.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (
    buf: Buffer,
    opts?: { max?: number },
  ) => Promise<{ text: string; numpages: number }>

  const data = await pdfParse(buf)

  if (data.numpages > 100) {
    throw new Error(ERRORS.pdfTooLarge(data.numpages))
  }

  if (data.text.trim().length < 50) {
    throw new Error(ERRORS.pdfImagesOnly)
  }

  return data.text
}

async function extractDOCX(buf: Buffer): Promise<string> {
  const mammoth = await import("mammoth")
  const result = await mammoth.extractRawText({ buffer: buf })
  return result.value
}

async function extractXLSX(buf: Buffer): Promise<string> {
  const XLSX = await import("xlsx")
  const workbook = XLSX.read(buf, { type: "buffer" })
  return workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name]
    return `--- Sheet: ${name} ---\n${XLSX.utils.sheet_to_csv(sheet)}`
  }).join("\n\n")
}

// ---------------------------------------------------------------------------
// HTML link discovery — finds PDF and same-host page links, scored by
// wine-related context (URL path, title attribute, anchor text).
// Score 2 = wine-flagged, score 1 = generic.
// ---------------------------------------------------------------------------
const WINE_LINK_RE = new RegExp(WINE_LIST_KEYWORDS.join("|"), "i")
const SKIP_LINK_RE =
  /datenschutz|impressum|agb|gutschein|privacy|mentions.leg|cgv|cgu|confidential|termini|terminos|aviso.legal|terms|cookie|voucher|newsletter|subscribe|sitemap|favicon|about|contact|legal|\.css|\.js/i

interface DiscoveredLink { url: string; score: number }

function extractLinksFromHTML(html: string, baseURL: string): { pdfs: DiscoveredLink[]; pages: DiscoveredLink[] } {
  const base = new URL(baseURL)
  const pdfs = new Map<string, number>()
  const pages = new Map<string, number>()
  const anchorRe = /<a\s[^>]*>/gi
  let m: RegExpExecArray | null
  while ((m = anchorRe.exec(html)) !== null) {
    const tag = m[0]
    const hrefMatch = /href=["']([^"']+)["']/.exec(tag)
    if (!hrefMatch) continue
    const href = hrefMatch[1]
    if (/^[#?]|^javascript:|^tel:|^mailto:/i.test(href)) continue
    if (SKIP_LINK_RE.test(href)) continue
    let url: URL
    try { url = new URL(href, baseURL) } catch { continue }
    if (!["http:", "https:"].includes(url.protocol)) continue
    const titleMatch = /title=["']([^"']*)["']/.exec(tag)
    const afterTag = html.slice(m.index + tag.length, m.index + tag.length + 80)
    const anchorText = afterTag.replace(/<[^>]+>/g, "").slice(0, 60)
    const context = `${titleMatch?.[1] ?? ""} ${anchorText} ${url.pathname}`
    const isPDF = url.pathname.toLowerCase().endsWith(".pdf")
    const score = WINE_LINK_RE.test(context) ? 2 : 1
    if (isPDF) {
      pdfs.set(url.href, Math.max(pdfs.get(url.href) ?? 0, score))
    } else if (url.hostname === base.hostname) {
      url.hash = ""
      const key = url.href
      if (key !== base.href.split("#")[0]) pages.set(key, Math.max(pages.get(key) ?? 0, score))
    }
  }
  const sorted = (map: Map<string, number>): DiscoveredLink[] =>
    [...map.entries()].sort((a, b) => b[1] - a[1]).map(([url, score]) => ({ url, score }))
  return { pdfs: sorted(pdfs), pages: sorted(pages) }
}

async function tryFetchPDF(pdfUrl: string): Promise<string | null> {
  try {
    const parsed = new URL(pdfUrl)
    if (!["http:", "https:"].includes(parsed.protocol)) return null
    const res = await fetch(pdfUrl, {
      headers: { "User-Agent": "DecantedBot/1.0 (+https://decanted.vercel.app)" },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return null
    return await extractPDF(Buffer.from(await res.arrayBuffer()))
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// HTML stripping
// ---------------------------------------------------------------------------
function stripHTML(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}
