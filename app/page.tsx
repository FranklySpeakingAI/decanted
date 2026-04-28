import { WineFinder } from "@/components/WineFinder"

// Extend serverless function timeout for LLM calls (Vercel Pro: up to 300s)
export const maxDuration = 60

export default function Page() {
  return <WineFinder />
}
