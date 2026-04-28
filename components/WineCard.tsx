import type { ScoredWine } from "@/lib/scoring"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const RANK_CONFIG = {
  1: {
    ring: "ring-2 ring-amber-400/60",
    rankBg: "bg-amber-400",
    rankText: "text-white",
    label: "1st",
    glow: "shadow-amber-100",
  },
  2: {
    ring: "ring-2 ring-stone-300/80",
    rankBg: "bg-stone-400",
    rankText: "text-white",
    label: "2nd",
    glow: "shadow-stone-100",
  },
  3: {
    ring: "ring-2 ring-amber-700/40",
    rankBg: "bg-amber-700",
    rankText: "text-white",
    label: "3rd",
    glow: "shadow-amber-50",
  },
} as const

const MARKUP_VARIANT = {
  green: "green",
  amber: "amber",
  red: "red",
} as const

interface WineCardProps {
  wine: ScoredWine
  rank: 1 | 2 | 3
}

export function WineCard({ wine, rank }: WineCardProps) {
  const cfg = RANK_CONFIG[rank]

  return (
    <div
      className={cn(
        "relative bg-white rounded-2xl p-5 shadow-md",
        cfg.ring,
        cfg.glow,
      )}
    >
      {/* Rank badge */}
      <div
        className={cn(
          "absolute -top-3 -left-1 px-2.5 py-0.5 rounded-full text-xs font-bold shadow",
          cfg.rankBg,
          cfg.rankText,
        )}
      >
        {cfg.label}
      </div>

      {/* Wine name & producer */}
      <div className="mb-3 pt-1">
        <h3 className="text-base font-semibold text-stone-900 leading-snug">
          {wine.name}
        </h3>
        <p className="text-sm text-stone-500 mt-0.5">{wine.producer}</p>
        <div className="flex items-center gap-1.5 mt-1 text-xs text-stone-400">
          {wine.vintage && <span>{wine.vintage}</span>}
          {wine.vintage && <span>·</span>}
          <span>{wine.region}</span>
        </div>
      </div>

      {/* Metric badges */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <Badge variant={MARKUP_VARIANT[wine.markupColor]}>
          {wine.markupFactor.toFixed(1)}× markup
        </Badge>
        <Badge variant="critic">{wine.criticScore} pts</Badge>
        <Badge variant="score">{wine.totalValueScore}/100 value</Badge>
      </div>

      {/* Sommelier note */}
      <p className="text-xs text-stone-500 italic leading-relaxed border-t border-stone-100 pt-3">
        {wine.sommelierNote}
      </p>

      {/* Food pairings */}
      {wine.foodPairings.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {wine.foodPairings.map((p) => (
            <span
              key={p}
              className="inline-block rounded-full bg-stone-100 px-2 py-0.5 text-[10px] text-stone-500"
            >
              {p}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
