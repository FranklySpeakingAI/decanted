"use client"

import { useEffect, useState } from "react"
import { AlertTriangle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

const MESSAGES = [
  { pct: 0,  text: "Reading your wine list…" },
  { pct: 35, text: "Checking market prices…" },
  { pct: 65, text: "Finding your best pours…" },
]

interface LoadingStateProps {
  startedAt: number
}

export function LoadingState({ startedAt }: LoadingStateProps) {
  const [msgIndex, setMsgIndex] = useState(0)
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    const t1 = setTimeout(() => setMsgIndex(1), 6_000)
    const t2 = setTimeout(() => setMsgIndex(2), 14_000)
    const t3 = setTimeout(() => setTimedOut(true), 25_000)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [startedAt])

  return (
    <div className="flex flex-col items-center gap-8 px-8 py-12 text-center w-full max-w-sm mx-auto">
      {/* Animated decanter icon */}
      <div className="relative">
        <div className="w-16 h-16 rounded-full bg-gold/10 flex items-center justify-center ring-1 ring-gold/25">
          <div className="absolute inset-0 rounded-full ring-1 ring-gold/20 animate-ping opacity-40" />
          <svg viewBox="0 0 22 28" fill="currentColor" className="w-7 h-7 text-gold" aria-hidden="true">
            <rect x="8.5" y="0" width="5" height="4" rx="2" />
            <rect x="9.5" y="4" width="3" height="6" />
            <path d="M4 10 C2 13 1 17 1 21 C1 25 5.5 27.5 11 27.5 C16.5 27.5 21 25 21 21 C21 17 20 13 18 10 Z" />
          </svg>
        </div>
      </div>

      {/* Message */}
      <div className="space-y-1">
        <p className="text-base font-semibold text-stone-800 transition-all duration-500">
          {MESSAGES[msgIndex].text}
        </p>
        <p className="text-xs text-stone-400">Our sommelier is hard at work</p>
      </div>

      {/* Progress bar */}
      <div className="w-full space-y-2">
        <div className="h-1 bg-stone-200 rounded-full overflow-hidden">
          <div className="progress-bar h-full rounded-full bg-gradient-to-r from-wine-accent via-wine-accent to-gold" />
        </div>
        <div className="flex justify-between text-[10px] text-stone-400">
          <span>Reading</span>
          <span>Pricing</span>
          <span>Scoring</span>
        </div>
      </div>

      {/* Timeout warning */}
      {timedOut && (
        <Alert variant="warning">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <AlertDescription>
            Still working — a large wine list can take a little longer. Hang tight!
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
