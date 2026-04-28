export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

export const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
])

// Extensions that are always rejected regardless of MIME type
const BLOCKED_EXTENSIONS = new Set([
  ".exe", ".js", ".mjs", ".cjs", ".sh", ".bash", ".zsh",
  ".zip", ".tar", ".gz", ".rar", ".7z",
  ".bat", ".cmd", ".ps1", ".vbs",
  ".py", ".rb", ".php", ".pl",
  ".html", ".htm", ".xml",
  ".dll", ".so", ".dylib",
  ".msi", ".pkg", ".dmg", ".deb", ".rpm",
])

export interface ValidationResult {
  valid: boolean
  error?: string
}

export async function checkMagicBytes(
  buffer: Uint8Array,
  mimeType: string,
): Promise<boolean> {
  if (buffer.length < 4) return false

  if (mimeType === "application/pdf") {
    // %PDF — 0x25 0x50 0x44 0x46
    return (
      buffer[0] === 0x25 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x44 &&
      buffer[3] === 0x46
    )
  }

  // Both DOCX and XLSX are ZIP archives — magic bytes PK\x03\x04
  if (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    return (
      buffer[0] === 0x50 &&
      buffer[1] === 0x4b &&
      buffer[2] === 0x03 &&
      buffer[3] === 0x04
    )
  }

  return false
}

export async function validateFile(file: File): Promise<ValidationResult> {
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: "size_exceeded" }
  }

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return { valid: false, error: "unsupported_type" }
  }

  const name = file.name.toLowerCase()
  for (const ext of BLOCKED_EXTENSIONS) {
    if (name.endsWith(ext)) {
      return { valid: false, error: "unsupported_type" }
    }
  }

  // Magic byte check — read first 4 bytes only
  const slice = file.slice(0, 4)
  const buffer = new Uint8Array(await slice.arrayBuffer())
  const magicOk = await checkMagicBytes(buffer, file.type)
  if (!magicOk) {
    return { valid: false, error: "unsupported_type" }
  }

  return { valid: true }
}

export function friendlyValidationError(error: string): string {
  if (error === "size_exceeded") {
    return "This file is too large. Please upload a file under 10 MB."
  }
  return "This file type isn't supported. Please upload a PDF, Word, or Excel file."
}
