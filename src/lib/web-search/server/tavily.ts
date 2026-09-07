/**
 * The Tavily Search API call behind the built-in web_search tool.
 *
 * The user's API key arrives in the request body on every call and is used once, here. It is
 * never written to a log, an error message or disk — the only place it is allowed to appear is
 * the Authorization header of the outgoing request.
 */
export const TAVILY_ENDPOINT = 'https://api.tavily.com/search'
export const REQUEST_TIMEOUT_MS = 30000

export const DEFAULT_MAX_RESULTS = 5
export const MIN_MAX_RESULTS = 1
export const MAX_MAX_RESULTS = 10
export const MAX_INCLUDE_DOMAINS = 20

export type SearchTopic = 'general' | 'news' | 'finance'
export type SearchDepth = 'basic' | 'advanced'
export type TimeRange = 'day' | 'week' | 'month' | 'year'

const TOPICS: Record<string, boolean> = { general: true, news: true, finance: true }
const DEPTHS: Record<string, boolean> = { basic: true, advanced: true }
const TIME_RANGES: Record<string, boolean> = { day: true, week: true, month: true, year: true }

export class WebSearchError extends Error {
  status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.name = 'WebSearchError'
    this.status = status
  }
}

export interface SearchInput {
  apiKey: string
  query: string
  maxResults?: unknown
  topic?: unknown
  timeRange?: unknown
  searchDepth?: unknown
  includeDomains?: unknown
}

/** The request parameters after validation, also used to build the cache key. */
export interface NormalisedParams {
  query: string
  maxResults: number
  topic: SearchTopic
  searchDepth: SearchDepth
  timeRange?: TimeRange
  includeDomains: string[]
}

export interface SearchResultItem {
  title: string
  url: string
  content: string
  score?: number
  publishedDate?: string
}

export interface SearchOutput {
  query: string
  answer?: string
  results: SearchResultItem[]
  responseTime?: number
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/**
 * Validate and clamp what the model sent. Anything out of range is corrected rather than
 * rejected, except an unknown enum value, which is a mistake worth telling the model about.
 */
export function normaliseParams(input: SearchInput): NormalisedParams {
  const query = asString(input.query).trim()
  if (!query) throw new WebSearchError('A "query" is required.', 400)

  let maxResults = DEFAULT_MAX_RESULTS
  if (input.maxResults !== undefined && input.maxResults !== null) {
    const numeric =
      typeof input.maxResults === 'number' ? input.maxResults : parseInt(String(input.maxResults), 10)
    if (isFinite(numeric)) {
      maxResults = Math.min(MAX_MAX_RESULTS, Math.max(MIN_MAX_RESULTS, Math.floor(numeric)))
    }
  }

  const topicRaw = asString(input.topic)
  if (topicRaw && !TOPICS[topicRaw]) {
    throw new WebSearchError('Unknown topic "' + topicRaw + '". Use general, news or finance.', 400)
  }
  const topic = (topicRaw || 'general') as SearchTopic

  const depthRaw = asString(input.searchDepth)
  if (depthRaw && !DEPTHS[depthRaw]) {
    throw new WebSearchError('Unknown search_depth "' + depthRaw + '". Use basic or advanced.', 400)
  }
  const searchDepth = (depthRaw || 'basic') as SearchDepth

  const rangeRaw = asString(input.timeRange)
  if (rangeRaw && !TIME_RANGES[rangeRaw]) {
    throw new WebSearchError(
      'Unknown time_range "' + rangeRaw + '". Use day, week, month or year.',
      400
    )
  }
  const timeRange = rangeRaw ? (rangeRaw as TimeRange) : undefined

  let includeDomains: string[] = []
  if (Array.isArray(input.includeDomains)) {
    includeDomains = input.includeDomains
      .filter((entry: unknown) => typeof entry === 'string')
      .map((entry: string) => entry.trim())
      .filter((entry: string) => entry.length > 0)
      .slice(0, MAX_INCLUDE_DOMAINS)
  }

  return { query, maxResults, topic, searchDepth, timeRange, includeDomains }
}

/** Map a Tavily status onto something the model can act on. */
function errorForStatus(status: number, body: string): WebSearchError {
  if (status === 401) {
    return new WebSearchError(
      'The Tavily API key is invalid or missing. The user has to fix it in the Built-in Tools panel.',
      status
    )
  }
  if (status === 429) {
    return new WebSearchError('Tavily rate limit hit; wait a moment before searching again.', status)
  }
  if (status === 432 || status === 433) {
    return new WebSearchError(
      'The Tavily plan limit is exhausted (status ' + status + '). The user has to upgrade or wait ' +
        'for the monthly reset.',
      status
    )
  }
  if (status === 400) {
    let detail = body.slice(0, 300)
    try {
      const parsed = JSON.parse(body)
      detail = String(parsed.detail?.error || parsed.detail || parsed.error || detail)
    } catch {
      // Keep the raw prefix.
    }
    return new WebSearchError('Tavily rejected the request: ' + detail, status)
  }
  return new WebSearchError('Tavily returned an unexpected status ' + status + '.', status)
}

export async function searchTavily(input: SearchInput, params: NormalisedParams): Promise<SearchOutput> {
  const apiKey = asString(input.apiKey).trim()
  if (!apiKey) {
    throw new WebSearchError(
      'The Tavily API key is invalid or missing. The user has to fix it in the Built-in Tools panel.',
      401
    )
  }

  const body: Record<string, unknown> = {
    query: params.query,
    max_results: params.maxResults,
    topic: params.topic,
    search_depth: params.searchDepth,
    include_answer: 'basic'
  }
  if (params.timeRange) body.time_range = params.timeRange
  if (params.includeDomains.length > 0) body.include_domains = params.includeDomains

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(TAVILY_ENDPOINT, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        // The only place the key is allowed to appear.
        Authorization: 'Bearer ' + apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })
  } catch (error: any) {
    clearTimeout(timer)
    if (error && error.name === 'AbortError') {
      throw new WebSearchError('Could not reach Tavily: the request timed out after 30 seconds.')
    }
    throw new WebSearchError(
      'Could not reach Tavily: ' + ((error && error.message) || 'network error') + '.'
    )
  }

  try {
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw errorForStatus(response.status, text)
    }

    const data: any = await response.json()
    const rawResults: any[] = Array.isArray(data.results) ? data.results : []

    const results: SearchResultItem[] = rawResults
      .filter((item) => item && typeof item.url === 'string' && item.url.trim())
      .map((item) => {
        const entry: SearchResultItem = {
          title: asString(item.title).trim() || asString(item.url),
          url: asString(item.url).trim(),
          content: asString(item.content).replace(/\s+/g, ' ').trim()
        }
        if (typeof item.score === 'number') entry.score = item.score
        const published = asString(item.published_date).trim()
        if (published) entry.publishedDate = published
        return entry
      })

    const answer = asString(data.answer).replace(/\s+/g, ' ').trim()

    return {
      query: asString(data.query).trim() || params.query,
      answer: answer || undefined,
      results,
      responseTime: typeof data.response_time === 'number' ? data.response_time : undefined
    }
  } finally {
    clearTimeout(timer)
  }
}
