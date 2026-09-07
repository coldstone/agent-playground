/**
 * Entry point of the server-side web_search pipeline: validate, cache, call Tavily.
 * Imported only from src/app/api/search/route.ts.
 */
import { searchTavily, normaliseParams, SearchInput, SearchOutput, WebSearchError } from './tavily'
import { getCachedSearch, setCachedSearch, searchCacheKey } from './cache'

export * from './tavily'
export * from './cache'

export interface WebSearchResult extends SearchOutput {
  cached: boolean
}

export async function runWebSearch(input: SearchInput): Promise<WebSearchResult> {
  const params = normaliseParams(input)
  const apiKey = typeof input.apiKey === 'string' ? input.apiKey.trim() : ''

  if (!apiKey) {
    throw new WebSearchError(
      'The Tavily API key is invalid or missing. The user has to fix it in the Built-in Tools panel.',
      401
    )
  }

  const key = searchCacheKey(apiKey, params)
  const hit = getCachedSearch(key)
  if (hit) return { ...hit, cached: true }

  const output = await searchTavily(input, params)
  setCachedSearch(key, output)
  return { ...output, cached: false }
}
