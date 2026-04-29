"use client"

import { useState, useMemo, useEffect, useRef } from "react"
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
import { APP, UI, ERRORS, DEFAULT_CURRENCY } from "@/lib/constants"

type InputMode = "url" | "file"
type Theme = "white-wine" | "red-wine"

// ── Decanter SVG mark ─────────────────────────────────────────────────────────
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

// ── Theme toggle ──────────────────────────────────────────────────────────────
function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("white-wine")

  useEffect(() => {
    const saved = (localStorage.getItem("decanted-theme") ?? "white-wine") as Theme
    setTheme(saved)
    document.documentElement.setAttribute("data-theme", saved)
  }, [])

  function toggle() {
    const next: Theme = theme === "white-wine" ? "red-wine" : "white-wine"
    setTheme(next)
    localStorage.setItem("decanted-theme", next)
    document.documentElement.setAttribute("data-theme", next)
  }

  const isWhite = theme === "white-wine"

  return (
    <button
      onClick={toggle}
      suppressHydrationWarning
      className="theme-toggle"
      aria-label="Switch wine theme"
    >
      <span className={cn("toggle-opt", isWhite && "is-active")}>
        🥂 <span className="opt-label">White Wine</span>
      </span>
      <span className={cn("toggle-opt", !isWhite && "is-active")}>
        🍷 <span className="opt-label">Red Wine</span>
      </span>
    </button>
  )
}

// ── Wordmark ──────────────────────────────────────────────────────────────────
function Wordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center"
        style={{ background: "rgba(200, 168, 75, 0.15)", boxShadow: "0 0 0 1px rgba(200, 168, 75, 0.25)" }}
      >
        <div style={{ color: "var(--accent-primary)" }}>
          <DecanterMark className="w-4 h-4" />
        </div>
      </div>
      <span
        className="wordmark text-xl font-semibold tracking-tight"
        style={{ color: "var(--text-primary)" }}
      >
        {APP.name}
      </span>
    </div>
  )
}

// ── How-It-Works step card ────────────────────────────────────────────────────
const HOW_IT_WORKS = [
  {
    n: "01",
    title: "Upload your list",
    body: "Drop a PDF or paste the restaurant URL. We do the rest.",
  },
  {
    n: "02",
    title: "We analyse every wine",
    body: "Our AI checks markup, critic scores, and market value across the full list.",
  },
  {
    n: "03",
    title: "Get your top picks",
    body: "See the best value bottles ranked for your food, your budget, your taste.",
  },
]

// ── Main component ────────────────────────────────────────────────────────────
export function WineFinder() {
  const [mode, setMode] = useState<InputMode>("url")
  const [isLoading, setIsLoading] = useState(false)
  const [loadingStartedAt, setLoadingStartedAt] = useState(0)
  const [wines, setWines] = useState<ScoredWine[] | null>(null)
  const [currency, setCurrency] = useState(DEFAULT_CURRENCY)
  const [error, setError] = useState<string | null>(null)

  const [selectedType, setSelectedType] = useState<WineType | null>(null)
  const [filters, setFilters] = useState<Filters>({
    food: null,
    region: null,
    priceMin: null,
    priceMax: null,
  })
  const [priceBounds, setPriceBounds] = useState<[number, number] | null>(null)

  const inputCardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!wines || wines.length === 0) return
    const prices = wines.map((w) => w.restaurantPrice)
    const minP = Math.min(...prices)
    const maxP = Math.max(...prices)
    setPriceBounds([minP, maxP])
    setFilters((f) => ({ ...f, priceMin: minP, priceMax: maxP }))
  }, [wines])

  const availableTypes = useMemo((): WineType[] => {
    if (!wines) return []
    const seen = new Set<WineType>()
    wines.forEach((w) => seen.add(w.type))
    return Array.from(seen)
  }, [wines])

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
        setCurrency(result.currency ?? DEFAULT_CURRENCY)
      } else {
        setError(result.error ?? ERRORS.generic)
      }
    } catch {
      setError(ERRORS.generic)
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

  return (
    <div className="relative">

      {/* Theme toggle — always fixed top-right ─────────────────────────── */}
      <ThemeToggle />

      {/* ── LANDING PAGE ─────────────────────────────────────────────────── */}
      {!hasResults && !isLoading && (
        <>
          {/* Zone 1 — Hero */}
          <section className="hero-bg relative min-h-dvh flex flex-col">

            {/* Nav */}
            <nav className="w-full max-w-6xl mx-auto px-6 pt-6 pb-4 flex items-center">
              <Wordmark />
            </nav>

            {/* Hero content */}
            <div className="flex-1 flex items-center justify-center px-5 py-10">
              <div className="max-w-2xl mx-auto text-center w-full">

                {/* Eyebrow */}
                <p
                  className="text-xs font-semibold tracking-[0.2em] uppercase mb-6"
                  style={{ color: "var(--accent-primary)" }}
                >
                  ✦ AI-Powered Wine Scanner
                </p>

                {/* Headline */}
                <h1
                  className="leading-tight mb-6"
                  style={{
                    fontFamily: "'Cormorant Garamond', Georgia, serif",
                    fontSize: "clamp(40px, 7vw, 64px)",
                    color: "var(--text-primary)",
                  }}
                >
                  Stop overpaying<br />for wine.
                </h1>

                {/* Subheadline */}
                <p
                  className="text-lg leading-relaxed mb-9 max-w-lg mx-auto"
                  style={{ color: "var(--text-muted)" }}
                >
                  Upload your restaurant&rsquo;s wine list. Decanted finds the best value
                  bottles &mdash; ranked by markup, critic score, and what you&rsquo;re eating.
                </p>

                {/* Benefit pills */}
                <div className="flex flex-wrap gap-2.5 justify-center mb-10">
                  {["📄 PDF or URL", "🍷 100+ wines analysed", "⚡ Results in seconds"].map((pill) => (
                    <span
                      key={pill}
                      className="px-4 py-1.5 rounded-full text-sm font-medium"
                      style={{
                        background: "var(--bg-glass)",
                        border: "1px solid var(--accent-border)",
                        color: "var(--text-muted)",
                        backdropFilter: "blur(8px)",
                        WebkitBackdropFilter: "blur(8px)",
                      }}
                    >
                      {pill}
                    </span>
                  ))}
                </div>

                {/* Glass-morphism input card */}
                <div
                  ref={inputCardRef}
                  className="text-left"
                  style={{
                    background: "var(--bg-glass)",
                    backdropFilter: "blur(12px)",
                    WebkitBackdropFilter: "blur(12px)",
                    border: "1px solid var(--accent-border)",
                    borderRadius: "16px",
                    padding: "28px",
                  }}
                >
                  {/* Mode toggle */}
                  <div
                    className="flex gap-1 p-1 rounded-xl mb-5"
                    style={{
                      background: "rgba(0,0,0,0.06)",
                      border: "1px solid var(--accent-border)",
                    }}
                  >
                    {(["url", "file"] as InputMode[]).map((m) => (
                      <button
                        key={m}
                        onClick={() => { setMode(m); setError(null) }}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all"
                        style={
                          mode === m
                            ? {
                                background: "var(--pill-active-bg)",
                                color: "var(--pill-active-text)",
                                boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                              }
                            : { color: "var(--text-muted)" }
                        }
                      >
                        {m === "url"
                          ? <Link2 className="w-3.5 h-3.5" />
                          : <FileUp className="w-3.5 h-3.5" />}
                        {m === "url" ? UI.scanUrl : UI.uploadFile}
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
                <p className="text-xs mt-5" style={{ color: "var(--text-muted)" }}>
                  No data stored. No account needed. Scans deleted instantly.
                </p>

              </div>
            </div>
          </section>

          {/* Zone 2 — How It Works */}
          <section className="px-5 py-24" style={{ background: "var(--bg-surface)" }}>
            <div className="max-w-4xl mx-auto">
              <h2
                className="text-center mb-16 leading-tight"
                style={{
                  fontFamily: "'Cormorant Garamond', Georgia, serif",
                  fontSize: "clamp(28px, 4vw, 42px)",
                  color: "var(--text-primary)",
                }}
              >
                Three steps to your perfect bottle
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {HOW_IT_WORKS.map(({ n, title, body }) => (
                  <div
                    key={n}
                    className="hiw-card rounded-2xl p-7"
                    style={{
                      background: "var(--bg-card)",
                      border: "1px solid var(--accent-border)",
                      borderTop: "3px solid var(--accent-primary)",
                    }}
                  >
                    <span
                      className="inline-block text-xs font-bold tracking-widest px-2.5 py-1 rounded-full mb-5"
                      style={{
                        background: "var(--accent-primary)",
                        color: "var(--pill-active-text)",
                      }}
                    >
                      {n}
                    </span>
                    <h3
                      className="font-semibold mb-2.5 leading-snug"
                      style={{
                        fontFamily: "'Cormorant Garamond', Georgia, serif",
                        fontSize: "22px",
                        color: "var(--text-primary)",
                      }}
                    >
                      {title}
                    </h3>
                    <p className="text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
                      {body}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Zone 3 — Mobile sticky CTA */}
          <div
            className="md:hidden fixed bottom-0 left-0 right-0 px-4 pt-3 pb-safe z-50"
            style={{
              background: "var(--bg-surface)",
              borderTop: "1px solid var(--accent-border)",
            }}
          >
            <button
              onClick={() =>
                inputCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
              }
              className="w-full py-3.5 rounded-xl font-semibold text-base transition-all hover:-translate-y-0.5"
              style={{
                background: "var(--accent-primary)",
                color: "var(--pill-active-text)",
              }}
            >
              Scan Wine List →
            </button>
          </div>
        </>
      )}

      {/* ── LOADING ──────────────────────────────────────────────────────── */}
      {isLoading && (
        <div
          className="min-h-dvh flex items-center justify-center"
          style={{ background: "var(--bg-base)" }}
        >
          <LoadingState startedAt={loadingStartedAt} />
        </div>
      )}

      {/* ── RESULTS ──────────────────────────────────────────────────────── */}
      {hasResults && (
        <div className="flex flex-col min-h-dvh" style={{ background: "var(--bg-base)" }}>

          {/* Results header */}
          <header
            className="safe-top px-5 pb-4 border-b"
            style={{
              background: "var(--bg-surface)",
              borderColor: "var(--accent-border)",
            }}
          >
            <div className="max-w-5xl mx-auto flex items-center gap-3">
              <Wordmark />
              <div className="ml-auto">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleReset}
                  style={{ color: "var(--text-muted)" }}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  {UI.newSearch}
                </Button>
              </div>
            </div>

            <div className="max-w-5xl mx-auto mt-3">
              <TypeFilterBar
                availableTypes={availableTypes}
                selected={selectedType}
                onChange={setSelectedType}
              />
            </div>
          </header>

          {/* Results body */}
          <section className="flex-1 px-5 pb-12 pt-6 max-w-5xl mx-auto w-full space-y-8">

            <div>
              <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                {UI.foundWines(wines!.length)}
              </h2>
            </div>

            <div
              className="p-4 rounded-2xl border shadow-sm"
              style={{ background: "var(--bg-card)", borderColor: "var(--accent-border)" }}
            >
              <FilterBar
                filters={filters}
                onChange={setFilters}
                priceBounds={priceBounds}
                currency={currency}
              />
            </div>

            {topPicks.length === 0 ? (
              <div className="text-center py-16" style={{ color: "var(--text-muted)" }}>
                <div style={{ color: "var(--accent-primary)" }}>
                  <DecanterMark className="w-10 h-10 mx-auto mb-4 opacity-30" />
                </div>
                <p className="text-sm">{UI.noWinesMatch}</p>
                <p className="text-xs mt-1">{UI.adjustFilters}</p>
              </div>
            ) : (
              <div>
                <p
                  className="text-[11px] uppercase tracking-widest font-semibold mb-3"
                  style={{ color: "var(--text-muted)" }}
                >
                  {UI.topPicks}
                </p>
                <TopPicksSection wines={topPicks} currency={currency} />
              </div>
            )}

            <FullWineList
              wines={secondaryFiltered}
              currency={currency}
              selectedType={selectedType}
            />
          </section>
        </div>
      )}
    </div>
  )
}
