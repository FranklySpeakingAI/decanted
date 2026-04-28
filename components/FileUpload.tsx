"use client"

import { useRef, useState, useCallback } from "react"
import { Upload, FileText, X, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
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

  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      setIsDragging(false)
      const dropped = e.dataTransfer.files[0]
      if (dropped) await handleFile(dropped)
    },
    [],
  )

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0]
    if (picked) handleFile(picked)
    e.target.value = ""
  }

  function clearFile() {
    setFile(null)
    setError(null)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (file) onSubmit(file)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <span className="text-xs font-medium text-stone-500 uppercase tracking-wider">
          Upload wine list
        </span>

        {file ? (
          <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 p-4">
            <FileText className="w-5 h-5 text-green-600 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-stone-800 truncate">
                {file.name}
              </p>
              <p className="text-xs text-stone-400">
                {(file.size / 1024).toFixed(0)} KB
              </p>
            </div>
            <button
              type="button"
              onClick={clearFile}
              className="text-stone-400 hover:text-stone-600 transition-colors"
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
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragging(true)
            }}
            onDragEnter={(e) => {
              e.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={cn(
              "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors cursor-pointer",
              isDragging
                ? "border-wine bg-wine/5"
                : "border-stone-200 bg-stone-50 hover:border-wine/40 hover:bg-stone-100",
            )}
          >
            <Upload
              className={cn(
                "w-7 h-7 transition-colors",
                isDragging ? "text-wine" : "text-stone-400",
              )}
            />
            <div>
              <p className="text-sm font-medium text-stone-700">
                Tap to choose a file
              </p>
              <p className="text-xs text-stone-400 mt-0.5">
                PDF, Word, or Excel · Max 10 MB
              </p>
            </div>
          </div>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}

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

      <Button
        type="submit"
        className="w-full"
        size="lg"
        disabled={disabled || !file}
      >
        <Search className="w-4 h-4" />
        Find Best Pours
      </Button>
    </form>
  )
}
