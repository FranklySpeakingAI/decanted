import { cn } from "@/lib/utils"

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

export function Input({ className, type, ...props }: InputProps) {
  return (
    <input
      type={type}
      className={cn(
        "flex h-11 w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-cream placeholder:text-cream/30 transition-colors",
        "focus:outline-none focus:ring-2 focus:ring-gold/50 focus:border-gold/40",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  )
}
