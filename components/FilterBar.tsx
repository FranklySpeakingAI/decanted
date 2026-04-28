"use client"

import type { FoodPairing, WineRegion } from "@/lib/scoring"
import { Button } from "@/components/ui/button"

const FOOD_PAIRINGS: FoodPairing[] = ["Chicken", "Beef", "Fish", "Vegetarian"]
const REGIONS: WineRegion[] = ["Bordeaux", "Burgundy", "Tuscany", "Napa", "Other"]

export interface Filters {
  food: FoodPairing | null
  region: WineRegion | null
}

interface FilterBarProps {
  filters: Filters
  onChange: (filters: Filters) => void
}

export function FilterBar({ filters, onChange }: FilterBarProps) {
  function toggleFood(food: FoodPairing) {
    onChange({ ...filters, food: filters.food === food ? null : food })
  }

  function toggleRegion(region: WineRegion) {
    onChange({ ...filters, region: filters.region === region ? null : region })
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-2">
          Food pairing
        </p>
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

      <div>
        <p className="text-[10px] font-semibold uppercase tracking-widest text-stone-400 mb-2">
          Region
        </p>
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
    </div>
  )
}
