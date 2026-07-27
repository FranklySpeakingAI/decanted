"use client"

import { useState } from "react"
import { Link2 } from "lucide-react"
import { Input } from "@/components/ui/input"

interface URLInputProps {
  onSubmit: (url: string) => void
  disabled?: boolean
}

export function URLInput({ onSubmit, disabled }: URLInputProps) {
  const [url, setUrl] = useState("")
  const [error, setError] = useState<string | null>(null)

  function validate(value: string): string | null {
    if (!value.trim()) return "Please enter a URL."
    try {
      const p = new URL(value.trim())
      if (!["http:", "https:"].includes(p.protocol)) {
        return "Only http and https URLs are supported."
      }
    } catch {
      return "Please enter a valid URL (e.g. https://restaurant.com/wine-list)."
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
        <label
          htmlFor="url-input"
          className="text-[10px] font-bold uppercase tracking-widest"
          style={{ color: "var(--text-muted)" }}
        >
          Restaurant website URL
        </label>
        <div className="relative">
          <Link2
            className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: "var(--text-muted)" }}
          />
          <Input
            id="url-input"
            type="url"
            placeholder="https://restaurant.com/wine-list"
            value={url}
            onChange={(e) => { setUrl(e.target.value); if (error) setError(null) }}
            className="pl-10"
            style={{
              background: "var(--bg-surface)",
              color: "var(--text-primary)",
              borderColor: "var(--accent-border)",
            }}
            disabled={disabled}
            autoComplete="off"
            inputMode="url"
          />
        </div>
        {error && <p className="text-xs text-rose-500">{error}</p>}
      </div>
      <button
        type="submit"
        disabled={disabled || !url.trim()}
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
