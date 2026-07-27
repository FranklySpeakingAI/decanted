"use server"

import { headers } from "next/headers"
import { lookup } from "node:dns/promises"
import { isIP } from "node:net"
import { validateFile, friendlyValidationError } from "@/lib/validators"
import { runPipeline } from "@/lib/pipeline"
import { isRateLimited } from "@/lib/budget"
import { scoreAndRankWines, type ProcessResult } from "@/lib/scoring"

function getClientIP(h: Awaited<ReturnType<typeof headers>>): string {
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown"
}

// ---------------------------------------------------------------------------
// Main server action
// ---------------------------------------------------------------------------
export async function processWineList(formData: FormData): Promise<ProcessResult> {
  try {
    const h = await headers()
    const ip = getClientIP(h)
    if (await isRateLimited(ip)) {
      return { success: false, error: "You've reached today's scan limit. Please try again tomorrow." }
    }

    const mode = formData.get("mode") as string | null
    if (mode === "url") return processURL(formData, ip)
    if (mode === "file") return processFile(formData, ip)
    return { success: false, error: "Invalid request." }
  } catch (err) {
    console.error("[processWineList]", err instanceof Error ? err.message : err)
    return { success: false, error: "Something went wrong. Please try again." }
  }
}

function toResult(
  wines: Awaited<ReturnType<typeof runPipeline>>["wines"],
  meta: Awaited<ReturnType<typeof runPipeline>>["meta"],
): ProcessResult {
  const scored = scoreAndRankWines(wines)
  return { success: true, wines: scored, currency: "CHF", meta }
}

// ---------------------------------------------------------------------------
// SSRF guard — resolve DNS and reject private / link-local / metadata targets.
// ---------------------------------------------------------------------------
function isBlockedIp(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase()
    return v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80") || v.startsWith("::ffff:")
  }
  const [a, b] = ip.split(".").map(Number)
  return (
    a === 10 ||
    a === 127 ||
    a === 0 ||
    (a === 169 && b === 254) || // link-local incl. 169.254.169.254 metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) // CGNAT
  )
}

async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error("Please provide a valid URL.")
  }
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Only http and https URLs are supported.")
  const host = url.hostname.toLowerCase()
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) {
    throw new Error("That address isn't allowed.")
  }
  const results = await lookup(host, { all: true }).catch(() => [])
  if (!results.length) throw new Error("Could not resolve that address.")
  if (results.some((r) => isBlockedIp(r.address))) throw new Error("That address isn't allowed.")
  return url
}

const FETCH_UA = "DecantedBot/1.0 (+https://decanted.ch)"
const MAX_PDF_BYTES = 10 * 1024 * 1024

async function safeFetch(raw: string, timeoutMs: number): Promise<Response> {
  await assertPublicUrl(raw)
  return fetch(raw, { headers: { "User-Agent": FETCH_UA }, signal: AbortSignal.timeout(timeoutMs), redirect: "manual" })
}

// ---------------------------------------------------------------------------
// URL mode — 1-hop crawl (rebuild §2.5), SSRF-guarded, PDF size/page capped.
// ---------------------------------------------------------------------------
async function processURL(formData: FormData, ip: string): Promise<ProcessResult> {
  const raw = ((formData.get("url") as string | null) ?? "").trim()
  if (!raw || raw.length > 2048) return { success: false, error: "Please provide a valid URL." }

  let content = ""
  let isHTML = false
  try {
    const res = await safeFetch(raw, 15_000)
    if (!res.ok) return { success: false, error: "Could not access that URL. Please check the address and try again." }

    const contentType = res.headers.get("content-type") ?? ""
    const isPDF = contentType.includes("application/pdf") || new URL(raw).pathname.toLowerCase().endsWith(".pdf")

    if (isPDF) {
      content = await extractPDF(Buffer.from(await res.arrayBuffer()))
    } else {
      isHTML = true
      const rawHtml = await res.text()
      const { pdfs, pages } = extractLinksFromHTML(rawHtml, raw)

      for (const { url: pdfUrl, score } of pdfs.slice(0, 2)) {
        if (score < 2) break
        const text = await tryFetchPDF(pdfUrl)
        if (text) { content = text; isHTML = false; break }
      }
      // one hop into wine-flagged sub-pages
      if (isHTML) {
        for (const { url: pageUrl, score } of pages.slice(0, 3)) {
          if (score < 2) break
          try {
            const subRes = await safeFetch(pageUrl, 8_000)
            if (!subRes.ok) continue
            const { pdfs: subPDFs } = extractLinksFromHTML(await subRes.text(), pageUrl)
            for (const { url: pdfUrl } of subPDFs.slice(0, 2)) {
              const text = await tryFetchPDF(pdfUrl)
              if (text) { content = text; isHTML = false; break }
            }
            if (!isHTML) break
          } catch { continue }
        }
      }
      if (isHTML) content = stripHTML(rawHtml).slice(0, 40_000)
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Could not access that URL." }
  }

  try {
    const { wines, meta } = await runPipeline({ content, sourceType: "url", sourceRef: raw, clientIp: ip })
    return toResult(wines, meta)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Analysis failed"
    console.error("[processURL]", msg)
    if (isHTML && msg.includes("Could not parse any wines")) {
      return { success: false, error: "No wine list found on that page. Try pasting the direct link to their wine list or PDF." }
    }
    return { success: false, error: msg }
  }
}

// ---------------------------------------------------------------------------
// File mode
// ---------------------------------------------------------------------------
async function processFile(formData: FormData, ip: string): Promise<ProcessResult> {
  const file = formData.get("file") as File | null
  if (!file) return { success: false, error: "No file provided." }

  const validation = await validateFile(file)
  if (!validation.valid) {
    return { success: false, error: friendlyValidationError(validation.error ?? "unsupported_type") }
  }

  const buffer = await file.arrayBuffer()
  let content: string
  try {
    content = await extractTextContent(file.type, buffer)
  } catch (err) {
    console.error("[extractTextContent]", err instanceof Error ? err.message : err)
    return { success: false, error: err instanceof Error ? err.message : "We couldn't read that file." }
  }
  if (!content.trim()) {
    return { success: false, error: "The file appears to be empty or contains only images. Please try a text-based PDF." }
  }

  try {
    const { wines, meta } = await runPipeline({ content, sourceType: "file", sourceRef: file.name, clientIp: ip })
    return toResult(wines, meta)
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Analysis failed"
    console.error("[processFile]", msg)
    return { success: false, error: msg }
  }
}

// ---------------------------------------------------------------------------
// Text extraction — in-memory, unpdf (replaces unmaintained pdf-parse v1)
// ---------------------------------------------------------------------------
async function extractTextContent(mimeType: string, buffer: ArrayBuffer): Promise<string> {
  const buf = Buffer.from(buffer)
  if (mimeType === "application/pdf") return extractPDF(buf)
  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return extractDOCX(buf)
  if (mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") return extractXLSX(buf)
  throw new Error(`Unsupported MIME type: ${mimeType}`)
}

async function extractPDF(buf: Buffer): Promise<string> {
  if (buf.byteLength > MAX_PDF_BYTES) {
    throw new Error("That PDF is too large (over 10 MB). Please upload just the wine-list section.")
  }
  const { getDocumentProxy, extractText } = await import("unpdf")
  const pdf = await getDocumentProxy(new Uint8Array(buf))
  if (pdf.numPages > 30) {
    throw new Error(`This PDF has ${pdf.numPages} pages. We scan up to 30 — please upload just the wine list.`)
  }
  const { text } = await extractText(pdf, { mergePages: true })
  const merged = Array.isArray(text) ? text.join("\n") : text
  if (merged.trim().length < 50) {
    // No text layer — image-only PDF. OCR fallback is scaffolded but off by
    // default (heavy on serverless; see scripts/prefill/README + rebuild §2.7).
    throw new Error("This PDF appears to be image-only (no selectable text). OCR isn't enabled yet — please try a text-based PDF.")
  }
  return merged
}

async function extractDOCX(buf: Buffer): Promise<string> {
  const mammoth = await import("mammoth")
  const result = await mammoth.extractRawText({ buffer: buf })
  return result.value
}

async function extractXLSX(buf: Buffer): Promise<string> {
  const XLSX = await import("xlsx")
  const workbook = XLSX.read(buf, { type: "buffer" })
  return workbook.SheetNames.map((name) => `--- Sheet: ${name} ---\n${XLSX.utils.sheet_to_csv(workbook.Sheets[name])}`).join("\n\n")
}

// ---------------------------------------------------------------------------
// HTML link discovery (unchanged scoring; SSRF-guarded fetch)
// ---------------------------------------------------------------------------
const WINE_LINK_RE = /wein|wine|vino|vins|vinothek|offenwein|weinkarte|cave\b|cantina|bodega|bebidas|bevande|drinks?|beverage|boisson|getränke/i
const SKIP_LINK_RE = /datenschutz|impressum|agb|gutschein|privacy|mentions.leg|cgv|cgu|confidential|termini|terminos|aviso.legal|terms|cookie|voucher|newsletter|subscribe|sitemap|favicon|about|contact|legal|\.css|\.js/i

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
      const kkey = url.href
      if (kkey !== base.href.split("#")[0]) pages.set(kkey, Math.max(pages.get(kkey) ?? 0, score))
    }
  }
  const sorted = (map: Map<string, number>): DiscoveredLink[] =>
    [...map.entries()].sort((a, b) => b[1] - a[1]).map(([url, score]) => ({ url, score }))
  return { pdfs: sorted(pdfs), pages: sorted(pages) }
}

async function tryFetchPDF(pdfUrl: string): Promise<string | null> {
  try {
    const res = await safeFetch(pdfUrl, 10_000)
    if (!res.ok) return null
    return await extractPDF(Buffer.from(await res.arrayBuffer()))
  } catch {
    return null
  }
}

function stripHTML(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}
