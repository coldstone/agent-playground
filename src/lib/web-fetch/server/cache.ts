/**
 * A tiny in-memory cache of converted pages.
 *
 * Chunked reading is the reason this exists: a long page is handed to the model 20k characters at
 * a time, and without a cache every "give me the next chunk" would re-fetch and re-convert the
 * whole document. Keyed by mode + URL, because the same URL in article and full mode are two
 * different documents.
 */
import { ExtractOutput } from './extract'

export interface CachedPage extends ExtractOutput {
  finalUrl: string
  status: number
  contentType: string
}

interface Entry {
  value: CachedPage
  expiresAt: number
}

export const CACHE_TTL_MS = 15 * 60 * 1000
export const CACHE_MAX_ENTRIES = 50

// Module scope, so it survives between requests in a warm server process but never leaves it.
const entries: Record<string, Entry> = {}
/** Insertion order, oldest first, used to evict without iterating the object. */
let order: string[] = []

function cacheKey(mode: string, url: string): string {
  return mode + '\n' + url
}

function drop(key: string): void {
  delete entries[key]
  order = order.filter((item) => item !== key)
}

export function getCachedPage(mode: string, url: string): CachedPage | undefined {
  const key = cacheKey(mode, url)
  const entry = entries[key]
  if (!entry) return undefined
  if (entry.expiresAt <= Date.now()) {
    drop(key)
    return undefined
  }
  return entry.value
}

export function setCachedPage(mode: string, url: string, value: CachedPage): void {
  const key = cacheKey(mode, url)
  if (entries[key]) drop(key)

  entries[key] = { value, expiresAt: Date.now() + CACHE_TTL_MS }
  order.push(key)

  while (order.length > CACHE_MAX_ENTRIES) {
    const oldest = order.shift()
    if (oldest) delete entries[oldest]
  }
}

/** Test and development helper; not used by the route. */
export function clearPageCache(): void {
  Object.keys(entries).forEach((key) => delete entries[key])
  order = []
}
