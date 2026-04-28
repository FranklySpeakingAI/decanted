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
        variant === "default" && "border-stone-200 bg-stone-50 text-stone-700",
        variant === "destructive" && "border-red-200 bg-red-50 text-red-800",
        variant === "warning" && "border-amber-200 bg-amber-50 text-amber-800",
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
