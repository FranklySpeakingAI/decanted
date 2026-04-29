"use client"

import { useState } from "react"
import { Link2, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { UI, UPLOAD, VALIDATION } from "@/lib/constants"

interface URLInputProps {
  onSubmit: (url: string) => void
  disabled?: boolean
}

export function URLInput({ onSubmit, disabled }: URLInputProps) {
  const [url, setUrl] = useState("")
  const [error, setError] = useState<string | null>(null)

  function validate(value: string): string | null {
    if (!value.trim()) return VALIDATION.urlEmpty
    try {
      const p = new URL(value.trim())
      if (!["http:", "https:"].includes(p.protocol)) {
        return VALIDATION.urlProtocol
      }
    } catch {
      return VALIDATION.urlInvalid
    }
    return null
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const err = validate(url)
    if (err) { setError(err); return }
    setError(null)
    onSubmit(url.trim())
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <label htmlFor="url-input" className="text-[10px] font-bold uppercase tracking-widest text-stone-400">
          {UPLOAD.urlLabel}
        </label>
        <div className="relative">
          <Link2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <Input
            id="url-input"
            type="url"
            placeholder={UPLOAD.urlPlaceholder}
            value={url}
            onChange={(e) => { setUrl(e.target.value); if (error) setError(null) }}
            className="pl-10"
            disabled={disabled}
            autoComplete="off"
            inputMode="url"
          />
        </div>
        {error && <p className="text-xs text-rose-500">{error}</p>}
      </div>
      <Button type="submit" className="w-full" size="lg" disabled={disabled || !url.trim()}>
        <Search className="w-4 h-4" />
        {UI.findBestPours}
      </Button>
    </form>
  )
}
