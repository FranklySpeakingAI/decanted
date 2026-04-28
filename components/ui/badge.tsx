import { type VariantProps, cva } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-wine text-white",
        secondary: "border-transparent bg-stone-100 text-stone-700",
        outline: "border-stone-200 text-stone-700",
        green: "border-green-200 bg-green-50 text-green-800",
        amber: "border-amber-200 bg-amber-50 text-amber-800",
        red: "border-red-200 bg-red-50 text-red-800",
        gold: "border-amber-300 bg-amber-50 text-amber-900",
        score: "border-indigo-200 bg-indigo-50 text-indigo-900",
        critic: "border-purple-200 bg-purple-50 text-purple-900",
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
