import { cn } from "@/lib/utils"

export function Alert({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  variant?: "default" | "destructive" | "warning"
}) {
  return (
    <div
      role="alert"
      className={cn(
        "relative flex items-start gap-3 rounded-xl border p-4 text-sm",
        variant === "default"     && "border-white/15 bg-white/5 text-cream/80",
        variant === "destructive" && "border-rose-500/30 bg-rose-500/10 text-rose-300",
        variant === "warning"     && "border-amber-400/30 bg-amber-400/10 text-amber-300",
        className,
      )}
      {...props}
    />
  )
}

export function AlertDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("leading-relaxed", className)} {...props} />
}
