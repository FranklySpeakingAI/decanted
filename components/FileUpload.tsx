"use client"

import { useRef, useState, useCallback } from "react"
import { Upload, FileText, X } from "lucide-react"
import { validateFile, friendlyValidationError } from "@/lib/validators"
import { cn } from "@/lib/utils"

const ACCEPT = ".pdf,.docx,.xlsx"
const ACCEPT_MIME =
  "application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

interface FileUploadProps {
  onSubmit: (file: File) => void
  disabled?: boolean
}

export function FileUpload({ onSubmit, disabled }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  async function handleFile(candidate: File) {
    setError(null)
    setFile(null)
    const result = await validateFile(candidate)
    if (!result.valid) {
      setError(friendlyValidationError(result.error ?? "unsupported_type"))
      return
    }
    setFile(candidate)
  }

  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) await handleFile(dropped)
  }, [])

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0]
    if (picked) handleFile(picked)
    e.target.value = ""
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (file) onSubmit(file) }} className="space-y-3">
      <div className="space-y-1.5">
        <span
          className="text-[10px] font-bold uppercase tracking-widest"
          style={{ color: "var(--text-muted)" }}
        >
          Upload wine list
        </span>

        {file ? (
          <div
            className="flex items-center gap-3 rounded-xl p-4"
            style={{
              border: "1px solid rgba(74, 107, 69, 0.5)",
              background: "rgba(74, 107, 69, 0.08)",
            }}
          >
            <FileText className="w-5 h-5 shrink-0" style={{ color: "var(--accent-sage, #7a9b76)" }} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                {file.name}
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {(file.size / 1024).toFixed(0)} KB
              </p>
            </div>
            <button
              type="button"
              onClick={() => { setFile(null); setError(null) }}
              className="transition-colors"
              style={{ color: "var(--text-muted)" }}
              aria-label="Remove file"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div
            role="button"
            tabIndex={0}
            aria-label="Click to select file or drag and drop"
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragEnter={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={cn(
              "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-all cursor-pointer",
            )}
            style={{
              borderColor: isDragging ? "var(--accent-primary)" : "var(--accent-border)",
              background: isDragging ? "rgba(200,168,75,0.06)" : "var(--bg-surface)",
              boxShadow: isDragging ? "0 0 0 2px var(--accent-primary)" : "none",
            }}
          >
            <Upload
              className="w-7 h-7 transition-colors"
              style={{ color: isDragging ? "var(--accent-primary)" : "var(--text-muted)" }}
            />
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                Tap to choose a file
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                PDF, Word, or Excel · Max 10 MB
              </p>
            </div>
          </div>
        )}

        {error && <p className="text-xs text-rose-500">{error}</p>}

        <input
          ref={inputRef}
          type="file"
          accept={`${ACCEPT},${ACCEPT_MIME}`}
          onChange={handleInputChange}
          className="sr-only"
          tabIndex={-1}
          aria-hidden="true"
        />
      </div>

      <button
        type="submit"
        disabled={disabled || !file}
        className="w-full h-12 rounded-[10px] text-base font-bold transition-all disabled:opacity-40 disabled:pointer-events-none"
        style={{
          background: "var(--accent-primary)",
          color: "var(--pill-active-text)",
        }}
      >
        Analyse My Wine List →
      </button>
    </form>
  )
}
