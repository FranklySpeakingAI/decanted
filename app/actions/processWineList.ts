"use server"

import { headers } from "next/headers"
import { validateFile, friendlyValidationError } from "@/lib/validators"
import { getLLMResponse } from "@/lib/mockLLM"
import { scoreAndRankWines, type ProcessResult } from "@/lib/scoring"

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
      return {
        success: false,
        error: "You've reached the limit of 10 searches per hour. Please try again later.",
      }
    }

    const mode = formData.get("mode") as string | null
    if (mode === "url") return processURL(formData)
    if (mode === "file") return processFile(formData)
    return { success: false, error: "Invalid request." }
  } catch (err) {
    console.error("[processWineList]", err instanceof Error ? err.message : err)
    return { success: false, error: "Something went wrong. Please try again." }
  }
}

// ---------------------------------------------------------------------------
// URL mode
// ---------------------------------------------------------------------------
async function processURL(formData: FormData): Promise<ProcessResult> {
  const raw = (formData.get("url") as string | null) ?? ""
  if (!raw || raw.length > 2048) return { success: false, error: "Please provide a valid URL." }

  let parsed: URL
  try { parsed = new URL(raw) } catch {
    return { success: false, error: "Please provide a valid URL." }
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return { success: false, error: "Only http and https URLs are supported." }
  }

  let content: string
  try {
    const res = await fetch(raw, {
      headers: { "User-Agent": "DecantedBot/1.0 (+https://decanted.vercel.app)" },
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) return { success: false, error: "Could not access that URL. Please check the address and try again." }

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
      const rawText = stripHTML(await res.text())
      content = rawText.slice(0, 40_000)
      console.log(`[extractTextContent] HTML from URL: ${rawText.length} chars raw → ${content.length} sent`)
    }
  } catch {
    return { success: false, error: "Could not access that URL. Please check the address and try again." }
  }

  try {
    const rawWines = await getLLMResponse({ mode: "url", content })
    const wines = scoreAndRankWines(rawWines)
    return { success: true, wines, currency: wines[0]?.currency ?? "CHF" }
  } catch (err) {
    const msg = err instanceof Error ? err.message : "LLM call failed"
    console.error("[processURL] LLM error:", msg)
    return { success: false, error: msg }
  }
}

// ---------------------------------------------------------------------------
// File mode
// ---------------------------------------------------------------------------
async function processFile(formData: FormData): Promise<ProcessResult> {
  const file = formData.get("file") as File | null
  if (!file) return { success: false, error: "No file provided." }

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
    return {
      success: false,
      error: "We couldn't read that file. Please try a different PDF, Word, or Excel file.",
    }
  }

  if (!content.trim()) {
    return {
      success: false,
      error: "The file appears to be empty or contains only images. Please try a text-based PDF.",
    }
  }

  console.log(`[extractTextContent] Extracted ${content.length} characters from file`)
  try {
    const rawWines = await getLLMResponse({ mode: "file", content })
    const wines = scoreAndRankWines(rawWines)
    return { success: true, wines, currency: wines[0]?.currency ?? "CHF" }
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

  if (data.numpages > 15) {
    throw new Error(
      `This wine list is too large (${data.numpages} pages). We can scan up to 15 pages — please upload just the wine list section.`,
    )
  }

  if (data.text.trim().length < 50) {
    throw new Error("PDF appears to contain only images — no extractable text found.")
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
