"use client"

import { useState, useMemo, useEffect } from "react"
import { Link2, FileUp, RotateCcw, AlertCircle } from "lucide-react"
import { processWineList } from "@/app/actions/processWineList"
import type { ScoredWine, FoodPairing, WineRegion, WineType } from "@/lib/scoring"
import { URLInput } from "@/components/URLInput"
import { FileUpload } from "@/components/FileUpload"
import { FilterBar, REGION_GROUPS, type Filters } from "@/components/FilterBar"
import { TypeFilterBar } from "@/components/TypeFilterBar"
import { TopPicksSection } from "@/components/TopPicksSection"
import { FullWineList } from "@/components/FullWineList"
import { LoadingState } from "@/components/LoadingState"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type InputMode = "url" | "file"
type Theme = "white-wine" | "red-wine"

function DecanterMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 22 28" fill="currentColor" className={className} aria-hidden="true">
      <rect x="8.5" y="0" width="5" height="4" rx="2" />
      <rect x="9.5" y="4" width="3" height="6" />
      <path d="M4 10 C2 13 1 17 1 21 C1 25 5.5 27.5 11 27.5 C16.5 27.5 21 25 21 21 C21 17 20 13 18 10 Z" />
      <ellipse cx="11" cy="20" rx="6" ry="1.5" fill="white" opacity="0.1" />
    </svg>
  )
}

function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all"
      style={{
        background: "var(--bg-glass)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        border: "1px solid var(--accent-border)",
        color: "var(--text-primary)",
      }}
      aria-label="Toggle wine theme"
    >
      {theme === "white-wine" ? (
        <>
          <span aria-hidden="true">🥂</span>
          <span className="hidden sm:inline">White Wine</span>
        </>
      ) : (
        <>
          <span aria-hidden="true">🍷</span>
          <span className="hidden sm:inline">Red Wine</span>
        </>
      )}
    </button>
  )
}

export function WineFinder() {
  const [mode, setMode] = useState<InputMode>("url")
  const [isLoading, setIsLoading] = useState(false)
  const [loadingStartedAt, setLoadingStartedAt] = useState(0)
  const [wines, setWines] = useState<ScoredWine[] | null>(null)
  const [currency, setCurrency] = useState("CHF")
  const [meta, setMeta] = useState<import("@/lib/scoring").ProcessResult["meta"] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [theme, setTheme] = useState<Theme>("white-wine")

  // Primary type filter
  const [selectedType, setSelectedType] = useState<WineType | null>(null)

  // Secondary filters (food pairing, region, price)
  const [filters, setFilters] = useState<Filters>({
    food: null,
    region: null,
    priceMin: null,
    priceMax: null,
  })
  const [priceBounds, setPriceBounds] = useState<[number, number] | null>(null)

  // Init theme from localStorage (after flash-prevention script in layout).
  // Syncing React state from an external store (localStorage) on mount is a
  // legitimate effect; the lint rule's cascade warning doesn't apply here.
  useEffect(() => {
    const saved = localStorage.getItem("decanted-theme") as Theme | null
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved === "red-wine") setTheme("red-wine")
  }, [])

  // Derive price-slider bounds from the freshly loaded wines.
  useEffect(() => {
    if (!wines || wines.length === 0) return
    const prices = wines.map((w) => w.restaurantPrice)
    const minP = Math.min(...prices)
    const maxP = Math.max(...prices)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPriceBounds([minP, maxP])
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFilters((f) => ({ ...f, priceMin: minP, priceMax: maxP }))
  }, [wines])

  function toggleTheme() {
    const next: Theme = theme === "white-wine" ? "red-wine" : "white-wine"
    setTheme(next)
    if (next === "red-wine") {
      document.documentElement.setAttribute("data-theme", "red-wine")
    } else {
      document.documentElement.removeAttribute("data-theme")
    }
    try { localStorage.setItem("decanted-theme", next) } catch { /* noop */ }
  }

  // Types actually present in the result set
  const availableTypes = useMemo((): WineType[] => {
    if (!wines) return []
    const seen = new Set<WineType>()
    wines.forEach((w) => seen.add(w.type))
    return Array.from(seen)
  }, [wines])

  // Secondary-filtered wine list (food, region, price)
  const secondaryFiltered = useMemo((): ScoredWine[] => {
    if (!wines) return []
    return wines.filter((w) => {
      if (filters.food && !w.foodPairings.includes(filters.food as FoodPairing)) return false
      if (filters.region) {
        const matchingRegions = REGION_GROUPS[filters.region] ?? []
        if (!matchingRegions.includes(w.region as WineRegion)) return false
      }
      if (filters.priceMin !== null && w.restaurantPrice < filters.priceMin) return false
      if (filters.priceMax !== null && w.restaurantPrice > filters.priceMax) return false
      return true
    })
  }, [wines, filters])

  // Top 3: within selectedType if set, else overall, after secondary filters
  const topPicks = useMemo((): ScoredWine[] => {
    const pool = selectedType
      ? secondaryFiltered.filter((w) => w.type === selectedType)
      : secondaryFiltered
    return pool.slice(0, 3)
  }, [secondaryFiltered, selectedType])

  async function submitFormData(fd: FormData) {
    setIsLoading(true)
    setError(null)
    setWines(null)
    setPriceBounds(null)
    setSelectedType(null)
    setFilters({ food: null, region: null, priceMin: null, priceMax: null })
    setLoadingStartedAt(Date.now())

    try {
      const result = await processWineList(fd)
      if (result.success && result.wines) {
        setWines(result.wines)
        setCurrency(result.currency ?? "CHF")
        setMeta(result.meta ?? null)
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
    setSelectedType(null)
    setFilters({ food: null, region: null, priceMin: null, priceMax: null })
  }

  const hasResults = wines !== null && !isLoading
  const isLanding = !hasResults && !isLoading

  // -------------------------------------------------------------------------
  // Landing page — 3-zone layout
  // -------------------------------------------------------------------------
  if (isLanding) {
    return (
      <div className="hero-animated-bg noise-overlay min-h-dvh" style={{ color: "var(--text-primary)" }}>

        {/* Fixed theme toggle — always top-right */}
        <div className="fixed top-4 right-4 z-50">
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Zone 1 — Full-viewport hero                                      */}
        {/* ---------------------------------------------------------------- */}
        <section className="relative min-h-dvh flex flex-col">

          {/* Wordmark */}
          <div className="safe-top px-6 pb-4 flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
              style={{
                background: "rgba(200,168,75,0.15)",
                boxShadow: "0 0 0 1px rgba(200,168,75,0.25)",
                color: "var(--accent-primary)",
              }}
            >
              <DecanterMark className="w-[18px] h-[18px]" />
            </div>
            <span className="wordmark text-xl" style={{ color: "var(--text-primary)" }}>
              Decanted
            </span>
          </div>

          {/* Hero centre content */}
          <div className="flex-1 flex items-center justify-center px-5 py-10">
            <div className="w-full max-w-lg mx-auto flex flex-col items-center text-center">

              {/* Eyebrow label */}
              <p
                className="text-xs font-semibold tracking-[0.2em] uppercase mb-4"
                style={{ color: "var(--accent-primary)" }}
              >
                ✦ AI-POWERED WINE SCANNER
              </p>

              {/* Headline */}
              <h1
                className="text-[40px] md:text-[64px] font-semibold leading-tight mb-4"
                style={{ fontFamily: "var(--font-cormorant), Georgia, serif", color: "var(--text-primary)" }}
              >
                Stop overpaying<br />for wine.
              </h1>

              {/* Subheadline */}
              <p
                className="text-lg leading-relaxed mb-7 max-w-sm"
                style={{ color: "var(--text-muted)" }}
              >
                Upload your restaurant&#39;s wine list. Decanted finds the best value bottles — ranked by markup, critic score, and what you&#39;re eating.
              </p>

              {/* Benefit pills */}
              <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
                {["📄 PDF or URL", "🍷 100+ wines analysed", "⚡ Results in seconds"].map((pill) => (
                  <span
                    key={pill}
                    className="px-3.5 py-1.5 rounded-full text-sm"
                    style={{
                      background: "var(--bg-glass)",
                      backdropFilter: "blur(8px)",
                      WebkitBackdropFilter: "blur(8px)",
                      border: "1px solid var(--accent-border)",
                      color: "var(--text-muted)",
                    }}
                  >
                    {pill}
                  </span>
                ))}
              </div>

              {/* Glassmorphism scan card */}
              <div className="glass-card w-full text-left">

                {/* Mode pill toggle */}
                <div
                  className="flex gap-1 p-1 rounded-xl mb-5"
                  style={{ background: "rgba(0,0,0,0.06)" }}
                >
                  {(["url", "file"] as InputMode[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => { setMode(m); setError(null) }}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all"
                      style={
                        mode === m
                          ? { background: "var(--pill-active-bg)", color: "var(--pill-active-text)" }
                          : { color: "var(--text-muted)" }
                      }
                    >
                      {m === "url" ? <Link2 className="w-3.5 h-3.5" /> : <FileUp className="w-3.5 h-3.5" />}
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
              </div>

              {/* Trust line */}
              <p className="mt-4 text-xs" style={{ color: "var(--text-muted)" }}>
                No data stored. No account needed. Scans deleted instantly.
              </p>

            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Zone 2 — How It Works                                            */}
        {/* ---------------------------------------------------------------- */}
        <section className="px-5 py-20 max-w-5xl mx-auto w-full">
          <h2
            className="text-4xl md:text-5xl font-semibold text-center mb-12"
            style={{ fontFamily: "var(--font-cormorant), Georgia, serif", color: "var(--text-primary)" }}
          >
            Three steps to your perfect bottle
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                num: "01",
                title: "Upload your list",
                body: "Drop a PDF or paste the restaurant URL. We do the rest.",
              },
              {
                num: "02",
                title: "We analyse every wine",
                body: "Our AI checks markup, critic scores, and market value across the full list.",
              },
              {
                num: "03",
                title: "Get your top picks",
                body: "See the best value bottles ranked for your food, your budget, your taste.",
              },
            ].map(({ num, title, body }) => (
              <div key={num} className="how-card">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold mb-4"
                  style={{ background: "var(--accent-primary)", color: "var(--pill-active-text)" }}
                >
                  {num}
                </div>
                <h3
                  className="text-xl font-semibold mb-2"
                  style={{ fontFamily: "var(--font-cormorant), Georgia, serif", color: "var(--text-primary)" }}
                >
                  {title}
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  {body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------------------------------------------------------------- */}
        {/* Zone 3 — Sticky mobile CTA                                       */}
        {/* ---------------------------------------------------------------- */}
        <div
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 p-4"
          style={{
            background: "var(--bg-surface)",
            borderTop: "1px solid var(--accent-border)",
          }}
        >
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="w-full py-3.5 rounded-xl font-semibold text-sm transition-all"
            style={{
              background: "var(--accent-primary)",
              color: "var(--pill-active-text)",
            }}
          >
            Scan Wine List →
          </button>
        </div>

      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Loading / Results — existing layout, theme toggle added to header
  // -------------------------------------------------------------------------
  return (
    <div className="flex flex-col min-h-dvh bg-sweep">

      {/* Header */}
      <header className="safe-top px-5 pb-4 bg-[#160b0f] border-b border-white/5">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
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
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            {hasResults && (
              <Button variant="ghost" size="sm" onClick={handleReset}>
                <RotateCcw className="w-3.5 h-3.5" />
                New search
              </Button>
            )}
          </div>
        </div>

        {/* Type filter pill bar — pinned below header when results are showing */}
        {hasResults && (
          <div className="max-w-5xl mx-auto mt-3">
            <TypeFilterBar
              availableTypes={availableTypes}
              selected={selectedType}
              onChange={setSelectedType}
            />
          </div>
        )}
      </header>

      {/* Loading */}
      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <LoadingState startedAt={loadingStartedAt} />
        </div>
      )}

      {/* Results */}
      {hasResults && (
        <section className="flex-1 px-5 pb-12 pt-6 max-w-5xl mx-auto w-full space-y-8">

          {/* Found count headline */}
          <div>
            <h2 className="text-sm font-semibold text-stone-800">
              Found {wines!.length} {wines!.length === 1 ? "wine" : "wines"} — here are your best pours
            </h2>
            {meta && (
              <p className="mt-1 text-[11px] text-stone-400">
                {meta.fromCache
                  ? "Served from cache — no new analysis needed"
                  : `${meta.dbHits}/${meta.total} matched from the catalogue · ${meta.enriched} newly analysed`}
              </p>
            )}
          </div>

          {/* Secondary filters */}
          <div className="p-4 rounded-2xl border border-stone-200 bg-white shadow-sm">
            <FilterBar
              filters={filters}
              onChange={setFilters}
              priceBounds={priceBounds}
              currency={currency}
            />
          </div>

          {/* Section A — Top 3 Hero Cards */}
          {topPicks.length === 0 ? (
            <div className="text-center py-16 text-stone-400">
              <DecanterMark className="w-10 h-10 mx-auto mb-4 opacity-30" />
              <p className="text-sm">No wines match those filters.</p>
              <p className="text-xs mt-1">Try adjusting your selection.</p>
            </div>
          ) : (
            <div>
              <p className="text-[11px] text-stone-400 uppercase tracking-widest font-semibold mb-3">
                Top picks
              </p>
              <TopPicksSection wines={topPicks} currency={currency} />
            </div>
          )}

          {/* Section B — Full Wine List */}
          <FullWineList
            wines={secondaryFiltered}
            currency={currency}
            selectedType={selectedType}
          />
        </section>
      )}
    </div>
  )
}
