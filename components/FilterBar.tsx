"use client"

import type { FoodPairing, WineRegion } from "@/lib/scoring"
import { Button } from "@/components/ui/button"
import { RangeSlider } from "@/components/ui/slider"

// ---------------------------------------------------------------------------
// Food pairing options (label, emoji, data value)
// ---------------------------------------------------------------------------
const FOOD_OPTIONS: { label: string; emoji: string; value: FoodPairing }[] = [
  { label: "Red Meat",   emoji: "🥩", value: "Red Meat" },
  { label: "White Meat", emoji: "🍗", value: "White Meat" },
  { label: "Game",       emoji: "🦌", value: "Game" },
  { label: "Fish",       emoji: "🐟", value: "Fish" },
  { label: "Vegetarian", emoji: "🥗", value: "Vegetarian" },
]

// ---------------------------------------------------------------------------
// Region groups — maps a filter label to all matching WineRegion values.
// Exported so WineFinder can use the same lookup for filter application.
// ---------------------------------------------------------------------------
export const REGION_GROUPS: Record<string, WineRegion[]> = {
  Bordeaux:         ["Bordeaux"],
  Burgundy:         ["Burgundy"],
  Champagne:        ["Champagne"],
  "Rhône":          ["Rhône"],
  Switzerland:      ["Swiss — Vaud", "Swiss — Valais", "Swiss — Geneva", "Swiss — Neuchâtel"],
  Italy:            ["Tuscany", "Piedmont", "Veneto", "Sicily"],
  "Germany/Austria":["Germany", "Austria"],
  Spain:            ["Rioja", "Ribera del Duero", "Priorat"],
  "New World":      ["Napa Valley", "Sonoma", "Argentina", "Chile", "Australia", "New Zealand", "South Africa"],
  Other:            ["Alsace", "Loire", "Languedoc", "Provence", "Jura", "Beaujolais", "Southwest France", "Other"],
}

const REGION_LABELS = Object.keys(REGION_GROUPS)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface Filters {
  food: FoodPairing | null
  region: string | null     // group label key from REGION_GROUPS
  priceMin: number | null
  priceMax: number | null
}

interface FilterBarProps {
  filters: Filters
  onChange: (filters: Filters) => void
  priceBounds: [number, number] | null
  currency: string
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[9px] font-bold uppercase tracking-widest text-stone-400 mb-2">
      {children}
    </p>
  )
}

export function FilterBar({ filters, onChange, priceBounds, currency }: FilterBarProps) {
  function toggleFood(value: FoodPairing) {
    onChange({ ...filters, food: filters.food === value ? null : value })
  }

  function toggleRegion(label: string) {
    onChange({ ...filters, region: filters.region === label ? null : label })
  }

  function handlePriceChange([min, max]: [number, number]) {
    onChange({ ...filters, priceMin: min, priceMax: max })
  }

  const sliderValue: [number, number] = [
    filters.priceMin ?? priceBounds?.[0] ?? 0,
    filters.priceMax ?? priceBounds?.[1] ?? 9999,
  ]

  return (
    <div className="space-y-4">
      {/* Food pairing */}
      <div>
        <SectionLabel>Food pairing</SectionLabel>
        <div className="flex gap-1.5 flex-wrap">
          {FOOD_OPTIONS.map(({ label, emoji, value }) => (
            <Button
              key={value}
              variant="filter"
              size="sm"
              data-active={filters.food === value}
              onClick={() => toggleFood(value)}
            >
              <span>{emoji}</span>
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* Region groups */}
      <div>
        <SectionLabel>Region</SectionLabel>
        <div className="flex gap-1.5 flex-wrap">
          {REGION_LABELS.map((label) => (
            <Button
              key={label}
              variant="filter"
              size="sm"
              data-active={filters.region === label}
              onClick={() => toggleRegion(label)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* Price range */}
      {priceBounds && priceBounds[0] < priceBounds[1] && (
        <div>
          <SectionLabel>Menu price range</SectionLabel>
          <RangeSlider
            min={priceBounds[0]}
            max={priceBounds[1]}
            value={sliderValue}
            onChange={handlePriceChange}
            formatLabel={(v) => `${currency} ${v}`}
          />
        </div>
      )}
    </div>
  )
}
