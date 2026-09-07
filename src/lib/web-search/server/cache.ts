/**
 * A short-lived cache of search responses.
 *
 * Searches cost the user real credits, and an auto-executing model that is not satisfied with a
 * result will happily repeat the same query two or three times in one turn. Ten minutes is long
 * enough to absorb that without hiding genuinely new results from a later question.
 *
 * The key is a sha256 over the API key plus the normalised parameters: two users of the same
 * server never share an entry, and the key itself is not recoverable from what we keep in memory.
 */
import { createHash } from 'crypto'
import { NormalisedParams, SearchOutput } from './tavily'

export const CACHE_TTL_MS = 10 * 60 * 1000
export const CACHE_MAX_ENTRIES = 100

interface Entry {
  value: SearchOutput
  expiresAt: number
}

const entries: Record<string, Entry> = {}
/** Insertion order, oldest first. */
let order: string[] = []

export function searchCacheKey(apiKey: string, params: NormalisedParams): string {
  const shape = JSON.stringify([
    params.query,
    params.maxResults,
    params.topic,
    params.searchDepth,
    params.timeRange || '',
    params.includeDomains
  ])
  // The key is hashed, never stored: the digest is enough to separate users.
  return createHash('sha256').update(apiKey).update('\n').update(shape).digest('hex')
}

function drop(key: string): void {
  delete entries[key]
  order = order.filter((item) => item !== key)
}

export function getCachedSearch(key: string): SearchOutput | undefined {
  const entry = entries[key]
  if (!entry) return undefined
  if (entry.expiresAt <= Date.now()) {
    drop(key)
    return undefined
  }
  return entry.value
}

export function setCachedSearch(key: string, value: SearchOutput): void {
  if (entries[key]) drop(key)

  entries[key] = { value, expiresAt: Date.now() + CACHE_TTL_MS }
  order.push(key)

  while (order.length > CACHE_MAX_ENTRIES) {
    const oldest = order.shift()
    if (oldest) delete entries[oldest]
  }
}

/** Test and development helper; not used by the route. */
export function clearSearchCache(): void {
  Object.keys(entries).forEach((key) => delete entries[key])
  order = []
}
