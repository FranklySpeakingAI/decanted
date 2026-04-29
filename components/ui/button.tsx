import { type VariantProps, cva } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:pointer-events-none disabled:opacity-40 active:scale-[0.97]",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-b from-wine-accent to-wine text-white shadow-lg shadow-wine/20 hover:brightness-110",
        outline:
          "border border-stone-300 bg-white text-stone-700 hover:bg-stone-50 hover:border-stone-400",
        ghost:
          "text-cream/60 hover:bg-white/8 hover:text-cream",
        filter:
          "border border-stone-200 bg-stone-50 text-stone-500 text-xs hover:bg-stone-100 hover:text-stone-700 data-[active=true]:border-gold/60 data-[active=true]:bg-gold/10 data-[active=true]:text-gold",
      },
      size: {
        default: "h-11 px-5 py-2",
        sm:      "h-8 px-3 text-xs",
        lg:      "h-12 px-7 text-base",
        icon:    "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ className, variant, size, ...props }: ButtonProps) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
}
