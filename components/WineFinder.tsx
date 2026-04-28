"use client"

import { useState, useMemo, useEffect } from "react"
import { Link2, FileUp, RotateCcw, AlertCircle } from "lucide-react"
import { processWineList } from "@/app/actions/processWineList"
import type { ScoredWine, FoodPairing, WineRegion } from "@/lib/scoring"
import { URLInput } from "@/components/URLInput"
import { FileUpload } from "@/components/FileUpload"
import { WineCard } from "@/components/WineCard"
import { FilterBar, REGION_GROUPS, type Filters } from "@/components/FilterBar"
import { LoadingState } from "@/components/LoadingState"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type InputMode = "url" | "file"

// Minimalist decanter SVG mark
function DecanterMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 22 28" fill="currentColor" className={className} aria-hidden="true">
      {/* Stopper */}
      <rect x="8.5" y="0" width="5" height="4" rx="2" />
      {/* Neck */}
      <rect x="9.5" y="4" width="3" height="6" />
      {/* Body */}
      <path d="M4 10 C2 13 1 17 1 21 C1 25 5.5 27.5 11 27.5 C16.5 27.5 21 25 21 21 C21 17 20 13 18 10 Z" />
      {/* Liquid shine */}
      <ellipse cx="11" cy="20" rx="6" ry="1.5" fill="white" opacity="0.1" />
    </svg>
  )
}

export function WineFinder() {
  const [mode, setMode] = useState<InputMode>("url")
  const [isLoading, setIsLoading] = useState(false)
  const [loadingStartedAt, setLoadingStartedAt] = useState(0)
  const [wines, setWines] = useState<ScoredWine[] | null>(null)
  const [currency, setCurrency] = useState("CHF")
  const [error, setError] = useState<string | null>(null)

  // Filter state
  const [filters, setFilters] = useState<Filters>({
    food: null,
    region: null,
    priceMin: null,
    priceMax: null,
  })
  // The actual bounds derived from the wine list
  const [priceBounds, setPriceBounds] = useState<[number, number] | null>(null)

  // Auto-initialize price slider bounds when wines load
  useEffect(() => {
    if (!wines || wines.length === 0) return
    const prices = wines.map((w) => w.restaurantPrice)
    const minP = Math.min(...prices)
    const maxP = Math.max(...prices)
    setPriceBounds([minP, maxP])
    setFilters((f) => ({ ...f, priceMin: minP, priceMax: maxP }))
  }, [wines])

  // Filtered top-3
  const podiumWines = useMemo((): ScoredWine[] => {
    if (!wines) return []
    return wines
      .filter((w) => {
        if (filters.food && !w.foodPairings.includes(filters.food as FoodPairing)) return false
        if (filters.region) {
          const matchingRegions = REGION_GROUPS[filters.region] ?? []
          if (!matchingRegions.includes(w.region as WineRegion)) return false
        }
        if (filters.priceMin !== null && w.restaurantPrice < filters.priceMin) return false
        if (filters.priceMax !== null && w.restaurantPrice > filters.priceMax) return false
        return true
      })
      .slice(0, 3)
  }, [wines, filters])

  async function submitFormData(fd: FormData) {
    setIsLoading(true)
    setError(null)
    setWines(null)
    setPriceBounds(null)
    setLoadingStartedAt(Date.now())

    try {
      const result = await processWineList(fd)
      if (result.success && result.wines) {
        setWines(result.wines)
        setCurrency(result.currency ?? "CHF")
      } else {
        setError(result.error ?? "Something went wrong. Please try again.")
      }
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  function handleURLSubmit(url: string) {
    const fd = new FormData()
    fd.append("mode", "url")
    fd.append("url", url)
    submitFormData(fd)
  }

  function handleFileSubmit(file: File) {
    const fd = new FormData()
    fd.append("mode", "file")
    fd.append("file", file)
    submitFormData(fd)
  }

  function handleReset() {
    setWines(null)
    setError(null)
    setPriceBounds(null)
    setFilters({ food: null, region: null, priceMin: null, priceMax: null })
  }

  const hasResults = wines !== null && !isLoading

  return (
    <div className="flex flex-col min-h-dvh bg-sweep">

      {/* ------------------------------------------------------------------ */}
      {/* Header                                                               */}
      {/* ------------------------------------------------------------------ */}
      <header className="safe-top px-5 pb-5 bg-[#160b0f] border-b border-white/5">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gold/15 flex items-center justify-center ring-1 ring-gold/20 shrink-0">
            <DecanterMark className="w-5 h-5 text-gold" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-cream tracking-tight leading-none">
              Decanted
            </h1>
            <p className="text-[11px] text-cream/40 leading-none mt-0.5">
              Find the best value pours at your table
            </p>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Input panel                                                           */}
      {/* ------------------------------------------------------------------ */}
      {!hasResults && !isLoading && (
        <section className="flex-1 px-5 py-6 max-w-lg mx-auto w-full">
          {/* Mode toggle */}
          <div className="flex gap-1 p-1 bg-white/5 rounded-xl mb-5 border border-white/8">
            {(["url", "file"] as InputMode[]).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(null) }}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all",
                  mode === m
                    ? "bg-wine-accent/80 text-white shadow-sm"
                    : "text-cream/50 hover:text-cream/80",
                )}
              >
                {m === "url"
                  ? <Link2 className="w-3.5 h-3.5" />
                  : <FileUp className="w-3.5 h-3.5" />}
                {m === "url" ? "Scan URL" : "Upload File"}
              </button>
            ))}
          </div>

          {mode === "url"
            ? <URLInput onSubmit={handleURLSubmit} disabled={isLoading} />
            : <FileUpload onSubmit={handleFileSubmit} disabled={isLoading} />}

          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </section>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Loading                                                               */}
      {/* ------------------------------------------------------------------ */}
      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <LoadingState startedAt={loadingStartedAt} />
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Results                                                              */}
      {/* ------------------------------------------------------------------ */}
      {hasResults && (
        <section className="flex-1 px-5 pb-10 pt-5 max-w-lg mx-auto w-full">
          {/* Row: count + reset */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-cream">Top Pours</h2>
              <p className="text-[11px] text-cream/40">{wines!.length} wines analysed</p>
            </div>
            <Button variant="ghost" size="sm" onClick={handleReset}>
              <RotateCcw className="w-3.5 h-3.5" />
              New search
            </Button>
          </div>

          {/* Filters */}
          <div className="mb-5 p-4 rounded-2xl border border-white/8 bg-white/4 backdrop-blur-sm">
            <FilterBar
              filters={filters}
              onChange={setFilters}
              priceBounds={priceBounds}
              currency={currency}
            />
          </div>

          {/* Podium cards */}
          {podiumWines.length === 0 ? (
            <div className="text-center py-16 text-cream/25">
              <DecanterMark className="w-10 h-10 mx-auto mb-4 opacity-30" />
              <p className="text-sm">No wines match those filters.</p>
              <p className="text-xs mt-1">Try adjusting your selection.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {podiumWines.map((wine, i) => (
                <div
                  key={wine.id}
                  className="animate-fade-in-up"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <WineCard wine={wine} rank={(i + 1) as 1 | 2 | 3} />
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
