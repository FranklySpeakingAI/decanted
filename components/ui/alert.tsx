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
        variant === "default"     && "border-stone-200 bg-stone-50 text-stone-700",
        variant === "destructive" && "border-rose-300 bg-rose-50 text-rose-700",
        variant === "warning"     && "border-amber-300 bg-amber-50 text-amber-700",
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
