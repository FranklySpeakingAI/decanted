"use client"

import type { WineType } from "@/lib/scoring"
import { cn } from "@/lib/utils"

export const TYPE_ORDER: WineType[] = [
  "Champagne",
  "White",
  "Red",
  "Rosé",
  "Sparkling",
  "Dessert",
  "Non-Alcoholic",
]

interface TypeFilterBarProps {
  availableTypes: WineType[]
  selected: WineType | null
  onChange: (type: WineType | null) => void
}

export function TypeFilterBar({ availableTypes, selected, onChange }: TypeFilterBarProps) {
  const orderedTypes = TYPE_ORDER.filter((t) => availableTypes.includes(t))

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none" style={{ scrollbarWidth: "none" }}>
      <Pill active={selected === null} onClick={() => onChange(null)}>
        All
      </Pill>
      {orderedTypes.map((type) => (
        <Pill
          key={type}
          active={selected === type}
          onClick={() => onChange(selected === type ? null : type)}
        >
          {type}
        </Pill>
      ))}
    </div>
  )
}

function Pill({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold transition-all border whitespace-nowrap",
        active
          ? "bg-gold text-black border-gold"
          : "bg-transparent text-gold border-gold/60 hover:border-gold hover:bg-gold/10",
      )}
    >
      {children}
    </button>
  )
}
