import "server-only"
import { getServiceClient } from "@/lib/supabase/server"
import { estimateCostChf, type TokenUsage } from "@/lib/pricing"

// Daily hard spend cap. Below this the app scans; over it, it refuses. This is
// the primary abuse control now that there's no login (see rebuild §2.6).
export const DAILY_BUDGET_CHF = Number(process.env.DAILY_BUDGET_CHF ?? 3)

// Per-IP daily scan cap (a speed bump; the budget cap is the real backstop).
export const RATE_LIMIT_PER_DAY = Number(process.env.RATE_LIMIT_PER_DAY ?? 10)

export interface BudgetState {
  ok: boolean
  spentChf: number
  capChf: number
}

// Check today's spend against the cap BEFORE making an LLM call. Fails open
// (allows the scan) if Supabase isn't configured — the pipeline degrades to the
// old stateless behaviour rather than blocking entirely.
export async function checkDailyBudget(): Promise<BudgetState> {
  const supabase = getServiceClient()
  if (!supabase) return { ok: true, spentChf: 0, capChf: DAILY_BUDGET_CHF }

  const { data, error } = await supabase.rpc("daily_spend_chf")
  if (error) {
    console.error("[budget] daily_spend_chf failed:", error.message)
    return { ok: true, spentChf: 0, capChf: DAILY_BUDGET_CHF } // fail open, but log
  }
  const spentChf = Number(data ?? 0)
  return { ok: spentChf < DAILY_BUDGET_CHF, spentChf, capChf: DAILY_BUDGET_CHF }
}

// Record actual token usage AFTER each LLM call. Both pipeline steps call this.
export async function recordUsage(args: {
  model: string
  step: "extraction" | "enrichment"
  usage: TokenUsage
  clientIp?: string | null
}): Promise<void> {
  const supabase = getServiceClient()
  if (!supabase) return

  const cost = estimateCostChf(args.model, args.usage)
  const { error } = await supabase.from("api_usage").insert({
    model: cost.model,
    step: args.step,
    input_tokens: cost.inputTokens,
    output_tokens: cost.outputTokens,
    cache_read_tokens: cost.cacheReadTokens,
    cache_write_tokens: cost.cacheWriteTokens,
    estimated_cost_chf: cost.estimatedCostChf,
    client_ip: args.clientIp ?? null,
  })
  if (error) console.error("[budget] recordUsage failed:", error.message)
}

// Atomic per-IP daily rate-limit check. Returns true if the caller is OVER the
// limit. Fails open if Supabase isn't configured.
export async function isRateLimited(clientIp: string): Promise<boolean> {
  const supabase = getServiceClient()
  if (!supabase) return false
  const { data, error } = await supabase.rpc("bump_rate_limit", { ip: clientIp })
  if (error) {
    console.error("[budget] bump_rate_limit failed:", error.message)
    return false
  }
  return Number(data ?? 0) > RATE_LIMIT_PER_DAY
}
