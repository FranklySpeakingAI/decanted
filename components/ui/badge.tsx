import { type VariantProps, cva } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide",
  {
    variants: {
      variant: {
        default:  "border-white/15 bg-white/10 text-cream",
        green:    "border-emerald-500/30 bg-emerald-500/15 text-emerald-300",
        amber:    "border-amber-400/30  bg-amber-400/15  text-amber-300",
        red:      "border-rose-500/30   bg-rose-500/15   text-rose-300",
        gold:     "border-gold/30       bg-gold/15       text-gold",
        score:    "border-violet-400/30 bg-violet-400/15 text-violet-300",
        critic:   "border-sky-400/30    bg-sky-400/15    text-sky-300",
      },
    },
    defaultVariants: { variant: "default" },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}
