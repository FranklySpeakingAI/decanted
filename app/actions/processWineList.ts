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

function getClientIP(headersList: Awaited<ReturnType<typeof headers>>): string {
  return (
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headersList.get("x-real-ip") ??
    "unknown"
  )
}

// ---------------------------------------------------------------------------
// Main server action — called from WineFinder client component
// ---------------------------------------------------------------------------
export async function processWineList(
  formData: FormData,
): Promise<ProcessResult> {
  try {
    const h = await headers()
    const ip = getClientIP(h)

    if (isRateLimited(ip)) {
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
    // Log internally without leaking details to the client
    console.error("[processWineList]", err instanceof Error ? err.message : err)
    return { success: false, error: "Something went wrong. Please try again." }
  }
}

// ---------------------------------------------------------------------------
// URL mode
// ---------------------------------------------------------------------------
const MAX_URL_LENGTH = 2048

async function processURL(formData: FormData): Promise<ProcessResult> {
  const raw = (formData.get("url") as string | null) ?? ""

  if (!raw || raw.length > MAX_URL_LENGTH) {
    return { success: false, error: "Please provide a valid URL." }
  }

  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return { success: false, error: "Please provide a valid URL." }
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return { success: false, error: "Only http and https URLs are supported." }
  }

  let content: string
  try {
    const res = await fetch(raw, {
      headers: { "User-Agent": "DecantedBot/1.0 (+https://decanted.app)" },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) {
      return {
        success: false,
        error: "Could not access that URL. Please check the address and try again.",
      }
    }
    const html = await res.text()
    content = stripHTML(html).slice(0, 50_000)
  } catch {
    return {
      success: false,
      error: "Could not access that URL. Please check the address and try again.",
    }
  }

  const rawWines = await getLLMResponse({ mode: "url", content })
  return { success: true, wines: scoreAndRankWines(rawWines) }
}

// ---------------------------------------------------------------------------
// File mode
// ---------------------------------------------------------------------------
async function processFile(formData: FormData): Promise<ProcessResult> {
  const file = formData.get("file") as File | null

  if (!file) {
    return { success: false, error: "No file provided." }
  }

  // Server-side validation (mirrors client-side — never trust client alone)
  const validation = await validateFile(file)
  if (!validation.valid) {
    return {
      success: false,
      error: friendlyValidationError(validation.error ?? "unsupported_type"),
    }
  }

  // Read entirely into memory; never touch the filesystem
  const buffer = await file.arrayBuffer()
  const content = await extractTextContent(file, buffer)

  const rawWines = await getLLMResponse({ mode: "file", content })
  return { success: true, wines: scoreAndRankWines(rawWines) }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stripHTML(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

async function extractTextContent(
  file: File,
  buffer: ArrayBuffer,
): Promise<string> {
  // Stub — returns file metadata for the mock LLM.
  // For production, replace with:
  //   PDF  → pdf-parse / pdfjs-dist
  //   DOCX → mammoth
  //   XLSX → xlsx (SheetJS)
  // The buffer is already in memory; pass it directly to the parser.
  void buffer
  return `Wine list extracted from uploaded file "${file.name}" (${Math.round(file.size / 1024)} KB, type: ${file.type}).`
}
