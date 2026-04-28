"use client"

import { useState, useMemo } from "react"
import { Wine, Link2, FileUp, RotateCcw, AlertCircle } from "lucide-react"
import { processWineList } from "@/app/actions/processWineList"
import type { ScoredWine, FoodPairing, WineRegion } from "@/lib/scoring"
import { URLInput } from "@/components/URLInput"
import { FileUpload } from "@/components/FileUpload"
import { WineCard } from "@/components/WineCard"
import { FilterBar, type Filters } from "@/components/FilterBar"
import { LoadingState } from "@/components/LoadingState"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type InputMode = "url" | "file"

export function WineFinder() {
  const [mode, setMode] = useState<InputMode>("url")
  const [isLoading, setIsLoading] = useState(false)
  const [loadingStartedAt, setLoadingStartedAt] = useState(0)
  const [wines, setWines] = useState<ScoredWine[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState<Filters>({ food: null, region: null })

  // Apply filters and return top 3
  const podiumWines = useMemo((): ScoredWine[] => {
    if (!wines) return []
    let filtered = wines
    if (filters.food) {
      filtered = filtered.filter((w) =>
        w.foodPairings.includes(filters.food as FoodPairing),
      )
    }
    if (filters.region) {
      filtered = filtered.filter((w) => w.region === (filters.region as WineRegion))
    }
    return filtered.slice(0, 3)
  }, [wines, filters])

  async function submitFormData(formData: FormData) {
    setIsLoading(true)
    setError(null)
    setWines(null)
    setLoadingStartedAt(Date.now())

    try {
      const result = await processWineList(formData)
      if (result.success && result.wines) {
        setWines(result.wines)
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
    setFilters({ food: null, region: null })
  }

  const hasResults = wines !== null && !isLoading

  return (
    <div className="flex flex-col min-h-screen bg-parchment">
      {/* ------------------------------------------------------------------ */}
      {/* Header                                                               */}
      {/* ------------------------------------------------------------------ */}
      <header className="bg-wine-dark text-white px-5 py-6 safe-top">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center">
              <Wine className="w-[18px] h-[18px] text-gold" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Decanted</h1>
          </div>
          <p className="text-xs text-wine-light/70 ml-[42px]">
            Find the best value pours at your table
          </p>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Input panel — hidden once results are shown                         */}
      {/* ------------------------------------------------------------------ */}
      {!hasResults && !isLoading && (
        <section className="px-5 py-6 max-w-lg mx-auto w-full">
          {/* Mode toggle */}
          <div className="flex gap-1 p-1 bg-stone-100 rounded-xl mb-5">
            {(["url", "file"] as InputMode[]).map((m) => (
              <button
                key={m}
                onClick={() => {
                  setMode(m)
                  setError(null)
                }}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all",
                  mode === m
                    ? "bg-white text-wine-dark shadow-sm"
                    : "text-stone-500 hover:text-stone-700",
                )}
              >
                {m === "url" ? (
                  <Link2 className="w-3.5 h-3.5" />
                ) : (
                  <FileUp className="w-3.5 h-3.5" />
                )}
                {m === "url" ? "Scan URL" : "Upload File"}
              </button>
            ))}
          </div>

          {/* Active input */}
          {mode === "url" ? (
            <URLInput onSubmit={handleURLSubmit} disabled={isLoading} />
          ) : (
            <FileUpload onSubmit={handleFileSubmit} disabled={isLoading} />
          )}

          {/* Error */}
          {error && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </section>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Loading state                                                        */}
      {/* ------------------------------------------------------------------ */}
      {isLoading && (
        <div className="max-w-lg mx-auto w-full">
          <LoadingState startedAt={loadingStartedAt} />
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Results                                                              */}
      {/* ------------------------------------------------------------------ */}
      {hasResults && (
        <section className="flex-1 px-5 pb-8 max-w-lg mx-auto w-full">
          {/* Header row */}
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-semibold text-stone-900">
                Top Pours
              </h2>
              <p className="text-xs text-stone-400">
                {wines!.length} wines analysed
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={handleReset}>
              <RotateCcw className="w-3.5 h-3.5" />
              New search
            </Button>
          </div>

          {/* Filters */}
          <div className="mb-5 p-4 bg-white rounded-2xl border border-stone-100 shadow-sm">
            <FilterBar filters={filters} onChange={setFilters} />
          </div>

          {/* Error (post-result) */}
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Podium cards */}
          {podiumWines.length === 0 ? (
            <div className="text-center py-12 text-stone-400">
              <Wine className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">
                No wines match those filters. Try adjusting your selection.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {podiumWines.map((wine, i) => (
                <WineCard
                  key={wine.id}
                  wine={wine}
                  rank={(i + 1) as 1 | 2 | 3}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
