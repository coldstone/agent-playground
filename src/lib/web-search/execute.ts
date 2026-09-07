/**
 * In-page execution of the built-in web_search tool.
 *
 * Validates what the model sent, posts it to /api/search together with the user's Tavily key, and
 * turns the response into the text the model reads. The closing line is deliberate: the snippets
 * are short, so the model is told how to get the rest.
 */
export interface WebSearchToolResult {
  text: string
  isError?: boolean
}

interface SearchApiResult {
  title: string
  url: string
  content: string
  score?: number
  publishedDate?: string
}

interface SearchApiResponse {
  query: string
  answer?: string
  results: SearchApiResult[]
  responseTime?: number
  cached: boolean
  error?: string
}

export interface WebSearchExecutionContext {
  apiKey: string
}

/** Snippets are cut here so a ten-result search stays a readable block, not a page of prose. */
const SNIPPET_MAX_CHARS = 600

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asInteger(value: unknown): number | undefined {
  const numeric = typeof value === 'number' ? value : typeof value === 'string' ? parseInt(value, 10) : NaN
  if (!isFinite(numeric)) return undefined
  return Math.floor(numeric)
}

function truncate(text: string, max: number): string {
  const collapsed = text.replace(/\s+/g, ' ').trim()
  return collapsed.length <= max ? collapsed : collapsed.slice(0, max).trim() + '…'
}

export function formatWebSearchResult(data: SearchApiResponse): string {
  const lines: string[] = ['Query: ' + data.query]

  if (data.answer) lines.push('Answer: ' + data.answer)

  if (data.results.length === 0) {
    return 'Query: ' + data.query + '\nNo results.'
  }

  lines.push('Results (' + data.results.length + '):')

  data.results.forEach((result, index) => {
    lines.push(index + 1 + '. ' + result.title)
    lines.push('   URL: ' + result.url)
    if (result.publishedDate) lines.push('   Published: ' + result.publishedDate)
    const snippet = truncate(result.content, SNIPPET_MAX_CHARS)
    if (snippet) lines.push('   ' + snippet)
  })

  lines.push('---')
  lines.push('Call web_fetch with a result URL to read the full page.')

  return lines.join('\n')
}

export async function executeWebSearchTool(
  args: Record<string, unknown>,
  context: WebSearchExecutionContext
): Promise<WebSearchToolResult> {
  const query = asString(args.query).trim()
  if (!query) {
    return { text: 'The "query" argument is required.', isError: true }
  }

  const apiKey = (context && context.apiKey ? context.apiKey : '').trim()
  if (!apiKey) {
    return {
      text: 'No Tavily API key is set. The user has to add one in the Built-in Tools panel.',
      isError: true
    }
  }

  const payload: Record<string, unknown> = { apiKey, query }

  const maxResults = asInteger(args.max_results)
  if (maxResults !== undefined) payload.maxResults = maxResults
  const topic = asString(args.topic)
  if (topic) payload.topic = topic
  const timeRange = asString(args.time_range)
  if (timeRange) payload.timeRange = timeRange
  const searchDepth = asString(args.search_depth)
  if (searchDepth) payload.searchDepth = searchDepth
  if (Array.isArray(args.include_domains)) payload.includeDomains = args.include_domains

  let response: Response
  try {
    response = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
  } catch (error) {
    return {
      text: 'Could not reach the search service: ' + (error instanceof Error ? error.message : 'network error'),
      isError: true
    }
  }

  let data: SearchApiResponse
  try {
    data = await response.json()
  } catch {
    return { text: 'The search service returned an unreadable response.', isError: true }
  }

  if (!response.ok || data.error) {
    return { text: data.error || 'The search failed with status ' + response.status + '.', isError: true }
  }

  return { text: formatWebSearchResult(data) }
}
