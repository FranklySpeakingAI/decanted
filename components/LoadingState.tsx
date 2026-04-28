"use client"

import { useEffect, useState } from "react"
import { Loader2, AlertTriangle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

const MESSAGES = [
  "Reading your wine list…",
  "Checking market prices…",
  "Finding your best pours…",
]

const TIMEOUT_WARNING_MS = 25_000

interface LoadingStateProps {
  startedAt: number
}

export function LoadingState({ startedAt }: LoadingStateProps) {
  const [msgIndex, setMsgIndex] = useState(0)
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    const rotate = setInterval(() => {
      setMsgIndex((i) => (i + 1) % MESSAGES.length)
    }, 3_000)

    const warn = setTimeout(() => setTimedOut(true), TIMEOUT_WARNING_MS)

    return () => {
      clearInterval(rotate)
      clearTimeout(warn)
    }
  }, [startedAt])

  return (
    <div className="flex flex-col items-center gap-6 py-10 px-6 text-center">
      <div className="relative">
        <div className="w-16 h-16 rounded-full bg-wine/10 flex items-center justify-center">
          <Loader2 className="w-8 h-8 text-wine animate-spin" />
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-base font-medium text-stone-800">
          {MESSAGES[msgIndex]}
        </p>
        <p className="text-xs text-stone-400">
          Our sommelier is hard at work
        </p>
      </div>

      {timedOut && (
        <Alert variant="warning" className="max-w-sm text-left">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <AlertDescription>
            Still working on it — complex lists can take a little longer.
            Hang tight!
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
