import { TokenUsage } from '@/types'

function toNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function firstNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    const n = toNumber(value)
    if (n !== undefined) return n
  }
  return undefined
}

/**
 * Normalize the `usage` object returned by different OpenAI-compatible providers
 * into a single shape. Handles, among others:
 * - OpenAI / Azure / Qwen / Doubao / OpenRouter: prompt_tokens_details.cached_tokens
 * - DeepSeek: prompt_cache_hit_tokens / prompt_cache_miss_tokens
 * - Moonshot (Kimi): cached_tokens
 * - Anthropic-style: input_tokens / output_tokens / cache_read_input_tokens / cache_creation_input_tokens
 */
export function normalizeUsage(raw: unknown): TokenUsage | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const u = raw as Record<string, any>

  const promptTokens = firstNumber(u.prompt_tokens, u.input_tokens) ?? 0
  const completionTokens = firstNumber(u.completion_tokens, u.output_tokens) ?? 0
  const totalTokens = firstNumber(u.total_tokens) ?? promptTokens + completionTokens

  const cachedTokens = firstNumber(
    u.prompt_tokens_details?.cached_tokens,
    u.input_tokens_details?.cached_tokens,
    u.prompt_cache_hit_tokens,
    u.cache_read_input_tokens,
    u.cached_tokens
  )

  const cacheWriteTokens = firstNumber(
    u.prompt_tokens_details?.cache_write_tokens,
    u.cache_creation_input_tokens,
    u.cache_write_tokens
  )

  const reasoningTokens = firstNumber(
    u.completion_tokens_details?.reasoning_tokens,
    u.output_tokens_details?.reasoning_tokens,
    u.reasoning_tokens
  )

  const usage: TokenUsage = {
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: totalTokens
  }
  if (cachedTokens !== undefined) usage.cached_tokens = cachedTokens
  if (cacheWriteTokens !== undefined) usage.cache_write_tokens = cacheWriteTokens
  if (reasoningTokens !== undefined) usage.reasoning_tokens = reasoningTokens
  return usage
}

export function emptyUsage(): TokenUsage {
  return { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 }
}

/** Sum two usage records; optional fields stay absent unless at least one side reports them. */
export function addUsage(a: TokenUsage, b?: TokenUsage | null): TokenUsage {
  if (!b) return { ...a }
  const sumOptional = (x?: number, y?: number) =>
    x === undefined && y === undefined ? undefined : (x ?? 0) + (y ?? 0)

  const result: TokenUsage = {
    prompt_tokens: (a.prompt_tokens || 0) + (b.prompt_tokens || 0),
    completion_tokens: (a.completion_tokens || 0) + (b.completion_tokens || 0),
    total_tokens: (a.total_tokens || 0) + (b.total_tokens || 0)
  }
  const cached = sumOptional(a.cached_tokens, b.cached_tokens)
  const cacheWrite = sumOptional(a.cache_write_tokens, b.cache_write_tokens)
  const reasoning = sumOptional(a.reasoning_tokens, b.reasoning_tokens)
  if (cached !== undefined) result.cached_tokens = cached
  if (cacheWrite !== undefined) result.cache_write_tokens = cacheWrite
  if (reasoning !== undefined) result.reasoning_tokens = reasoning
  return result
}

export function formatTokenCount(n: number): string {
  return (n || 0).toLocaleString('en-US')
}
