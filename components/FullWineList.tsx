"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import type { ScoredWine, WineType } from "@/lib/scoring"
import { cn } from "@/lib/utils"
import { TYPE_ORDER } from "@/components/TypeFilterBar"

const MARKUP_DOT: Record<string, string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red:   "bg-rose-500",
}

interface FullWineListProps {
  wines: ScoredWine[]
  currency: string
  selectedType: WineType | null
}

export function FullWineList({ wines, currency, selectedType }: FullWineListProps) {
  const groups = TYPE_ORDER
    .map((type) => ({
      type,
      wines: wines
        .filter((w) => w.type === type)
        .sort((a, b) => b.totalValueScore - a.totalValueScore),
    }))
    .filter((g) => g.wines.length > 0)

  const visibleGroups = selectedType
    ? groups.filter((g) => g.type === selectedType)
    : groups

  if (visibleGroups.length === 0) return null

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-px bg-stone-200" />
        <span className="text-[11px] text-stone-400 uppercase tracking-widest font-semibold whitespace-nowrap">
          All {wines.length} wines found
        </span>
        <div className="flex-1 h-px bg-stone-200" />
      </div>

      <div className="space-y-2">
        {visibleGroups.map((group) => (
          <WineTypeGroup
            key={`${group.type}-${selectedType ?? "all"}`}
            type={group.type}
            wines={group.wines}
            currency={currency}
            defaultOpen={selectedType !== null}
          />
        ))}
      </div>
    </div>
  )
}

function WineTypeGroup({
  type,
  wines,
  currency,
  defaultOpen,
}: {
  type: WineType
  wines: ScoredWine[]
  currency: string
  defaultOpen: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden shadow-sm">
      {/* Group header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-stone-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {open
            ? <ChevronDown className="w-3.5 h-3.5 text-stone-400" />
            : <ChevronRight className="w-3.5 h-3.5 text-stone-400" />}
          <span className="text-sm font-semibold text-stone-700">{type}</span>
          <span className="text-xs text-stone-400">— {wines.length} {wines.length === 1 ? "wine" : "wines"}</span>
        </div>
        <span className="text-[10px] text-stone-400">sorted by value</span>
      </button>

      {/* Wine rows */}
      {open && (
        <div className="border-t border-stone-100 divide-y divide-stone-100">
          {wines.map((wine) => (
            <WineRow key={wine.id} wine={wine} currency={currency} />
          ))}
        </div>
      )}
    </div>
  )
}

function WineRow({ wine, currency }: { wine: ScoredWine; currency: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      {/* Markup dot */}
      <div className={cn("w-2 h-2 rounded-full shrink-0", MARKUP_DOT[wine.markupColor])} />

      {/* Name + vintage */}
      <div className="flex-1 min-w-0">
        <span className="text-sm text-stone-800 font-medium truncate block">{wine.name}</span>
        {wine.vintage && (
          <span className="text-[11px] text-stone-400">{wine.vintage}</span>
        )}
      </div>

      {/* Menu price */}
      <span className="text-xs text-stone-500 shrink-0">
        {currency} {wine.restaurantPrice}
      </span>

      {/* Markup */}
      <span className="text-xs text-stone-400 shrink-0 w-10 text-right">
        {wine.markupFactor.toFixed(1)}×
      </span>

      {/* Critic score */}
      <span className="text-xs text-stone-400 shrink-0 w-12 text-right">
        {wine.criticScore ? `${wine.criticScore}pts` : "—"}
      </span>
    </div>
  )
}
