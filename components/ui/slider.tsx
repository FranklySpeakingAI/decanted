"use client"

import { cn } from "@/lib/utils"

interface RangeSliderProps {
  min: number
  max: number
  value: [number, number]
  onChange: (value: [number, number]) => void
  formatLabel?: (v: number) => string
  className?: string
}

export function RangeSlider({
  min,
  max,
  value,
  onChange,
  formatLabel = String,
  className,
}: RangeSliderProps) {
  const [low, high] = value
  const range = Math.max(max - min, 1)

  const lowPct = ((low - min) / range) * 100
  const highPct = ((high - min) / range) * 100

  return (
    <div className={cn("space-y-2", className)}>
      {/* Selected range — updates live as the thumbs move */}
      <div
        className="flex justify-between text-sm font-semibold"
        style={{ color: "var(--text-primary)" }}
      >
        <span>{formatLabel(low)}</span>
        <span>{formatLabel(high)}</span>
      </div>

      {/* Track + thumbs */}
      <div className="relative h-5 flex items-center">
        {/* Background track */}
        <div
          className="absolute inset-x-0 h-[3px] rounded-full"
          style={{ background: "var(--accent-border)" }}
        />
        {/* Active segment */}
        <div
          className="absolute h-[3px] rounded-full"
          style={{ left: `${lowPct}%`, width: `${highPct - lowPct}%`, background: "var(--accent-primary)" }}
        />
        {/* Min thumb */}
        <input
          type="range"
          min={min}
          max={max}
          value={low}
          aria-label="Mindestpreis"
          onChange={(e) => {
            const v = Math.min(Number(e.target.value), high - 1)
            onChange([v, high])
          }}
          className="range-thumb absolute w-full"
        />
        {/* Max thumb */}
        <input
          type="range"
          min={min}
          max={max}
          value={high}
          aria-label="Höchstpreis"
          onChange={(e) => {
            const v = Math.max(Number(e.target.value), low + 1)
            onChange([low, v])
          }}
          className="range-thumb absolute w-full"
        />
      </div>

      {/* Absolute bounds of the data set */}
      <div
        className="flex justify-between text-[10px]"
        style={{ color: "var(--text-muted)" }}
      >
        <span>{formatLabel(min)}</span>
        <span>{formatLabel(max)}</span>
      </div>
    </div>
  )
}
