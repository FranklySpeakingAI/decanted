"use client"

import type { FoodPairing, WineRegion } from "@/lib/scoring"
import { Button } from "@/components/ui/button"
import { RangeSlider } from "@/components/ui/slider"

const FOOD_PAIRINGS: FoodPairing[] = ["Chicken", "Beef", "Fish", "Vegetarian"]
const REGIONS: WineRegion[] = ["Bordeaux", "Burgundy", "Tuscany", "Napa", "Other"]

export interface Filters {
  food: FoodPairing | null
  region: WineRegion | null
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
    <p className="text-[9px] font-bold uppercase tracking-widest text-cream/30 mb-2">
      {children}
    </p>
  )
}

export function FilterBar({ filters, onChange, priceBounds, currency }: FilterBarProps) {
  function toggleFood(food: FoodPairing) {
    onChange({ ...filters, food: filters.food === food ? null : food })
  }

  function toggleRegion(region: WineRegion) {
    onChange({ ...filters, region: filters.region === region ? null : region })
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
          {FOOD_PAIRINGS.map((food) => (
            <Button
              key={food}
              variant="filter"
              size="sm"
              data-active={filters.food === food}
              onClick={() => toggleFood(food)}
            >
              {food}
            </Button>
          ))}
        </div>
      </div>

      {/* Region */}
      <div>
        <SectionLabel>Region</SectionLabel>
        <div className="flex gap-1.5 flex-wrap">
          {REGIONS.map((region) => (
            <Button
              key={region}
              variant="filter"
              size="sm"
              data-active={filters.region === region}
              onClick={() => toggleRegion(region)}
            >
              {region}
            </Button>
          ))}
        </div>
      </div>

      {/* Price range slider — only shown when we have bounds */}
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
