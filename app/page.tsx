import { WineFinder } from "@/components/WineFinder"

// Extend serverless function timeout for LLM calls. A cold ~150-wine list runs
// parallel extraction + enrichment waves that can exceed 60s (Vercel Fluid/Pro
// allows up to 300s).
export const maxDuration = 300

export default function Page() {
  return <WineFinder />
}
