"use client"

import type { ScoredWine } from "@/lib/scoring"
import { cn } from "@/lib/utils"

const MARKUP_DOT: Record<string, string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red:   "bg-rose-500",
}

const MARKUP_TEXT: Record<string, string> = {
  green: "text-emerald-600",
  amber: "text-amber-600",
  red:   "text-rose-600",
}

interface TopPicksSectionProps {
  wines: ScoredWine[]
  currency: string
}

export function TopPicksSection({ wines, currency }: TopPicksSectionProps) {
  const top3 = wines.slice(0, 3)

  if (top3.length === 0) return null

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {top3.map((wine, i) => (
        <div
          key={wine.id}
          className="animate-fade-in-up"
          style={{ animationDelay: `${i * 150}ms` }}
        >
          <HeroCard wine={wine} rank={i + 1} currency={currency} />
        </div>
      ))}
    </div>
  )
}

function HeroCard({
  wine,
  rank,
  currency,
}: {
  wine: ScoredWine
  rank: number
  currency: string
}) {
  return (
    <div
      className={cn(
        "relative flex flex-col gap-3 rounded-2xl p-5 border bg-white h-full shadow-sm",
        rank === 1 ? "ring-2 ring-amber-400/60 border-amber-300" : "border-stone-200",
      )}
    >
      {/* Rank pill */}
      <div
        className={cn(
          "absolute -top-2.5 left-4 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider",
          rank === 1
            ? "bg-amber-400 text-black"
            : rank === 2
            ? "bg-stone-200 text-stone-600"
            : "bg-stone-100 text-stone-500",
        )}
      >
        {rank === 1 ? "1st" : rank === 2 ? "2nd" : "3rd"}
      </div>

      {/* Identity */}
      <div className="pt-1">
        <h3 className="text-lg font-bold text-gold leading-snug">{wine.name}</h3>
        <p className="text-xs text-stone-500 mt-0.5">{wine.producer}</p>
        <div className="flex flex-wrap items-center gap-1.5 mt-2">
          {wine.vintage && (
            <span className="text-[11px] text-stone-400">{wine.vintage}</span>
          )}
          <span className="rounded-full bg-stone-100 border border-stone-200 px-2 py-0.5 text-[10px] text-stone-500">
            {wine.region}
          </span>
          <span className="rounded-full bg-gold/15 border border-gold/25 px-2 py-0.5 text-[10px] text-gold font-medium">
            {wine.type}
          </span>
        </div>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-2 gap-1.5">
        <MetricCell label="Menu price" value={`${currency} ${wine.restaurantPrice}`} />
        <MetricCell label="Est. market" value={`~${currency} ${wine.marketPrice}`} />

        {/* Markup */}
        <div className="flex flex-col gap-0.5 p-2.5 rounded-xl border border-stone-100 bg-stone-50">
          <span className="text-[9px] uppercase tracking-widest text-stone-400 font-semibold">
            Markup
          </span>
          <div className="flex items-center gap-1.5">
            <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", MARKUP_DOT[wine.markupColor])} />
            <span className={cn("text-sm font-bold leading-none", MARKUP_TEXT[wine.markupColor])}>
              {wine.markupFactor.toFixed(1)}×
            </span>
          </div>
        </div>

        {/* Critic score */}
        <MetricCell
          label="Critic score"
          value={wine.criticScore ? `${wine.criticScore} pts` : "—"}
        />
      </div>

      {/* Sommelier note */}
      {wine.sommelierNote && (
        <p className="text-xs text-stone-500 italic leading-relaxed border-t border-stone-100 pt-3 mt-auto">
          {wine.sommelierNote}
        </p>
      )}
    </div>
  )
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 p-2.5 rounded-xl border border-stone-100 bg-stone-50">
      <span className="text-[9px] uppercase tracking-widest text-stone-400 font-semibold">
        {label}
      </span>
      <span className="text-sm font-bold leading-none text-stone-900">{value}</span>
    </div>
  )
}
