import type { ScoredWine } from "@/lib/scoring"
import { cn } from "@/lib/utils"

const RANK = {
  1: { label: "1st", ring: "ring-2 ring-amber-400/50", rankCls: "bg-amber-400 text-black" },
  2: { label: "2nd", ring: "ring-1 ring-white/15",      rankCls: "bg-white/20 text-cream" },
  3: { label: "3rd", ring: "ring-1 ring-white/10",      rankCls: "bg-white/12 text-cream/70" },
} as const

const MARKUP_DOT: Record<string, string> = {
  green: "bg-emerald-400",
  amber: "bg-amber-400",
  red:   "bg-rose-400",
}

const MARKUP_TEXT: Record<string, string> = {
  green: "text-emerald-300",
  amber: "text-amber-300",
  red:   "text-rose-300",
}

interface WineCardProps {
  wine: ScoredWine
  rank: 1 | 2 | 3
}

interface MetricCellProps {
  label: string
  value: string
  sub?: string
  highlight?: boolean
  className?: string
}

function MetricCell({ label, value, sub, highlight, className }: MetricCellProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-0.5 p-2.5 rounded-xl border",
        highlight
          ? "border-gold/30 bg-gold/10"
          : "border-white/8 bg-white/4",
        className,
      )}
    >
      <span className="text-[9px] uppercase tracking-widest text-cream/40 font-semibold">
        {label}
      </span>
      <span
        className={cn(
          "text-sm font-bold leading-none",
          highlight ? "text-gold" : "text-cream",
        )}
      >
        {value}
      </span>
      {sub && (
        <span className="text-[10px] text-cream/40 leading-none">{sub}</span>
      )}
    </div>
  )
}

export function WineCard({ wine, rank }: WineCardProps) {
  const cfg = RANK[rank]
  const cur = wine.currency ?? "CHF"

  return (
    <div
      className={cn(
        "relative rounded-2xl p-5 border border-white/8",
        "bg-white/5 backdrop-blur-md",
        cfg.ring,
      )}
    >
      {/* Rank pill */}
      <div
        className={cn(
          "absolute -top-2.5 left-4 px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider",
          cfg.rankCls,
        )}
      >
        {cfg.label}
      </div>

      {/* Wine identity */}
      <div className="mb-4 pt-1">
        <h3 className="text-base font-bold text-gold leading-snug">{wine.name}</h3>
        <p className="text-xs text-cream/55 mt-0.5">{wine.producer}</p>
        <div className="flex items-center gap-1.5 mt-1 text-[11px] text-cream/35">
          {wine.vintage && <span>{wine.vintage}</span>}
          {wine.vintage && <span>·</span>}
          <span>{wine.region}</span>
        </div>
      </div>

      {/* Metric grid — 3 columns row 1, 2 columns row 2 */}
      <div className="grid grid-cols-3 gap-1.5 mb-1.5">
        <MetricCell
          label="Menu"
          value={`${cur} ${wine.restaurantPrice}`}
        />
        <MetricCell
          label="Market est."
          value={`~${cur} ${wine.marketPrice}`}
        />
        {/* Markup cell with colour indicator */}
        <div
          className={cn(
            "flex flex-col gap-0.5 p-2.5 rounded-xl border border-white/8 bg-white/4",
          )}
        >
          <span className="text-[9px] uppercase tracking-widest text-cream/40 font-semibold">
            Markup
          </span>
          <div className="flex items-center gap-1.5">
            <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", MARKUP_DOT[wine.markupColor])} />
            <span className={cn("text-sm font-bold leading-none", MARKUP_TEXT[wine.markupColor])}>
              {wine.markupFactor.toFixed(1)}×
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5 mb-4">
        <MetricCell
          label="Critic score"
          value={`${wine.criticScore} pts`}
        />
        <MetricCell
          label="Value score"
          value={`${wine.totalValueScore}/100`}
          highlight
        />
      </div>

      {/* Sommelier note */}
      <p className="text-xs text-cream/50 italic leading-relaxed border-t border-white/8 pt-3">
        {wine.sommelierNote}
      </p>

      {/* Food pairings */}
      {wine.foodPairings.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2.5">
          {wine.foodPairings.map((p) => (
            <span
              key={p}
              className="rounded-full bg-white/8 border border-white/10 px-2 py-0.5 text-[10px] text-cream/50"
            >
              {p}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
