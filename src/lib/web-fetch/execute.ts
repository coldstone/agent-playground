/**
 * In-page execution of the built-in web_fetch tool.
 *
 * The work happens in /api/fetch; this module validates what the model sent, calls the route and
 * formats the result the model reads. The header block matters: it tells the model which URL it
 * actually landed on after redirects, how the page was reduced, and - when the page was cut - the
 * exact start_index to ask for next.
 */
export interface WebFetchToolResult {
  text: string
  isError?: boolean
}

interface FetchApiResponse {
  url: string
  finalUrl: string
  status: number
  contentType: string
  title?: string
  description?: string
  siteName?: string
  lang?: string
  extracted: string
  totalLength: number
  startIndex: number
  endIndex: number
  truncated: boolean
  content: string
  cached: boolean
  error?: string
}

export interface WebFetchExecutionContext {
  /** Forwarded to the target site so it returns content in the user's language. */
  acceptLanguage?: string
}

const EXTRACTED_LABELS: Record<string, string> = {
  article: 'article (main content)',
  full: 'full page',
  'full-fallback': 'full page (main content not detected)',
  raw: 'raw',
  json: 'json',
  text: 'text'
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asInteger(value: unknown): number | undefined {
  const numeric = typeof value === 'number' ? value : typeof value === 'string' ? parseInt(value, 10) : NaN
  if (!isFinite(numeric)) return undefined
  return Math.floor(numeric)
}

export function formatWebFetchResult(data: FetchApiResponse): string {
  const lines: string[] = []

  if (data.title) lines.push('Title: ' + data.title)
  lines.push('URL: ' + data.finalUrl)
  if (data.finalUrl !== data.url) lines.push('Requested: ' + data.url)
  if (data.contentType) lines.push('Content-Type: ' + data.contentType)
  lines.push('Extracted: ' + (EXTRACTED_LABELS[data.extracted] || data.extracted))
  if (data.description) lines.push('Description: ' + data.description)

  const range =
    data.totalLength === 0
      ? 'empty'
      : data.totalLength + ' characters (showing ' + data.startIndex + '-' + data.endIndex + ')'
  lines.push('Length: ' + range)

  let text = lines.join('\n') + '\n---\n' + data.content

  if (data.truncated) {
    text +=
      '\n---\n[Truncated. Call web_fetch again with start_index=' + data.endIndex + ' to continue.]'
  }

  return text
}

export async function executeWebFetchTool(
  args: Record<string, unknown>,
  context?: WebFetchExecutionContext
): Promise<WebFetchToolResult> {
  const url = asString(args.url).trim()

  if (!url) {
    return { text: 'The "url" argument is required.', isError: true }
  }
  if (!/^https?:\/\//i.test(url)) {
    return { text: 'The URL must be absolute and start with http:// or https:// (got "' + url + '").', isError: true }
  }

  const mode = asString(args.mode)
  const payload: Record<string, unknown> = { url }
  if (mode === 'article' || mode === 'full' || mode === 'raw') payload.mode = mode

  const maxLength = asInteger(args.max_length)
  if (maxLength !== undefined) payload.maxLength = maxLength
  const startIndex = asInteger(args.start_index)
  if (startIndex !== undefined) payload.startIndex = startIndex

  let response: Response
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (context && context.acceptLanguage) headers['Accept-Language'] = context.acceptLanguage
    response = await fetch('/api/fetch', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    })
  } catch (error) {
    return {
      text: 'Could not reach the fetch service: ' + (error instanceof Error ? error.message : 'network error'),
      isError: true
    }
  }

  let data: FetchApiResponse
  try {
    data = await response.json()
  } catch {
    return { text: 'The fetch service returned an unreadable response.', isError: true }
  }

  if (!response.ok || data.error) {
    return { text: data.error || 'The fetch failed with status ' + response.status + '.', isError: true }
  }

  return { text: formatWebFetchResult(data) }
}
