'use client'

import React from 'react'
import { TokenUsage } from '@/types'
import { formatTokenCount, normalizeUsage } from '@/lib/usage'
import { Tooltip } from '@/components/ui/tooltip'
import { ArrowUp, ArrowDown, Database, Sigma } from 'lucide-react'

interface UsageDisplayProps {
  /** Normalized usage, or the raw provider usage object from older stored messages */
  usage: TokenUsage | Record<string, unknown>
  className?: string
}

/**
 * Compact token usage line: input (with cached breakdown), output, total.
 */
export function UsageDisplay({ usage: rawUsage, className = '' }: UsageDisplayProps) {
  // Messages stored before normalization keep the provider's raw shape; normalize on render
  const usage = normalizeUsage(rawUsage) ?? (rawUsage as TokenUsage)
  const hasCache = usage.cached_tokens !== undefined || usage.cache_write_tokens !== undefined
  const cached = usage.cached_tokens ?? 0
  const cacheWrite = usage.cache_write_tokens
  const uncached = Math.max(usage.prompt_tokens - cached, 0)

  const inputTooltip = hasCache
    ? `Input ${formatTokenCount(usage.prompt_tokens)} tokens = ${formatTokenCount(uncached)} fresh + ${formatTokenCount(cached)} from cache${
        cacheWrite !== undefined ? `, ${formatTokenCount(cacheWrite)} written to cache` : ''
      }`
    : `Input ${formatTokenCount(usage.prompt_tokens)} tokens (provider did not report cache usage)`

  const outputTooltip =
    usage.reasoning_tokens !== undefined
      ? `Output ${formatTokenCount(usage.completion_tokens)} tokens, of which ${formatTokenCount(usage.reasoning_tokens)} reasoning`
      : `Output ${formatTokenCount(usage.completion_tokens)} tokens`

  return (
    <span className={`inline-flex flex-wrap items-center gap-x-2 gap-y-0.5 ${className}`}>
      <span className="font-medium">Tokens:</span>
      <Tooltip content={inputTooltip}>
        <span className="inline-flex items-center gap-0.5 cursor-default">
          <ArrowUp className="w-3 h-3" />
          {formatTokenCount(usage.prompt_tokens)} in
        </span>
      </Tooltip>

      {hasCache && (
        <Tooltip content={inputTooltip}>
          <span
            className={`inline-flex items-center gap-0.5 cursor-default ${
              cached > 0 ? 'text-emerald-600 dark:text-emerald-400' : ''
            }`}
          >
            <Database className="w-3 h-3" />
            {formatTokenCount(cached)} cached
            {cacheWrite !== undefined && cacheWrite > 0 && (
              <span className="opacity-70">(+{formatTokenCount(cacheWrite)} write)</span>
            )}
          </span>
        </Tooltip>
      )}

      <Tooltip content={outputTooltip}>
        <span className="inline-flex items-center gap-0.5 cursor-default">
          <ArrowDown className="w-3 h-3" />
          {formatTokenCount(usage.completion_tokens)} out
          {usage.reasoning_tokens !== undefined && usage.reasoning_tokens > 0 && (
            <span className="opacity-70">({formatTokenCount(usage.reasoning_tokens)} reasoning)</span>
          )}
        </span>
      </Tooltip>

      <span className="inline-flex items-center gap-0.5">
        <Sigma className="w-3 h-3" />
        {formatTokenCount(usage.total_tokens)} total tokens
      </span>
    </span>
  )
}
