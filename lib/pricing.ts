// Token pricing for the spend ledger + daily budget cap, in CHF.
//
// Rates are Anthropic's Haiku 4.5 list prices expressed directly in CHF (per 1M
// tokens): ~CHF 0.90 input / ~CHF 4.50 output. Cache reads bill ~0.1x input;
// 5-minute cache writes bill 1.25x input. This is a spend *guardrail*, not
// accounting — the daily cap bounds spend regardless — so fixed CHF constants
// are fine. If Anthropic changes prices materially, edit these two numbers.

const CHF_PER_MTOK = {
  "claude-haiku-4-5-20251001": { input: 0.9, output: 4.5 },
} as const

const DEFAULT_MODEL = "claude-haiku-4-5-20251001"
const CACHE_READ_MULTIPLIER = 0.1
const CACHE_WRITE_MULTIPLIER = 1.25

export interface TokenUsage {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens?: number
  cache_creation_input_tokens?: number
}

export interface CostBreakdown {
  model: string
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  estimatedCostChf: number
}

export function estimateCostChf(model: string, usage: TokenUsage): CostBreakdown {
  const rates = CHF_PER_MTOK[model as keyof typeof CHF_PER_MTOK] ?? CHF_PER_MTOK[DEFAULT_MODEL]
  const input = usage.input_tokens ?? 0
  const output = usage.output_tokens ?? 0
  const cacheRead = usage.cache_read_input_tokens ?? 0
  const cacheWrite = usage.cache_creation_input_tokens ?? 0

  const chf =
    (input * rates.input +
      output * rates.output +
      cacheRead * rates.input * CACHE_READ_MULTIPLIER +
      cacheWrite * rates.input * CACHE_WRITE_MULTIPLIER) /
    1_000_000

  return {
    model,
    inputTokens: input,
    outputTokens: output,
    cacheReadTokens: cacheRead,
    cacheWriteTokens: cacheWrite,
    estimatedCostChf: Math.round(chf * 10_000) / 10_000,
  }
}
