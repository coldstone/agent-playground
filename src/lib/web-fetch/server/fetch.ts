/**
 * Server-side HTTP fetching for the built-in web_fetch tool.
 *
 * Redirects are followed manually so that guardUrl() can inspect every hop, and the body is read
 * through the stream so an oversized response is abandoned instead of buffered. Charset detection
 * matters more than it looks: a fair share of Chinese pages are still GB18030 or Big5, and
 * decoding those as UTF-8 produces markdown full of replacement characters.
 */
import { guardUrl } from './guard'

export const MAX_BODY_BYTES = 5 * 1024 * 1024
export const REQUEST_TIMEOUT_MS = 20000
export const MAX_REDIRECTS = 5

// The version here is bumped at release time, together with CLIENT_INFO in
// src/lib/mcp/server/connection-manager.ts.
const USER_AGENT =
  'Mozilla/5.0 (compatible; AgentPlayground/0.3.1; +https://github.com/coldstone/agent-playground)'
const ACCEPT =
  'text/html, application/xhtml+xml, application/json, text/plain, text/markdown, */*;q=0.8'

export class WebFetchError extends Error {
  status?: number
  constructor(message: string, status?: number) {
    super(message)
    this.name = 'WebFetchError'
    this.status = status
  }
}

export interface RawResponse {
  /** URL of the last hop, after redirects. */
  finalUrl: string
  status: number
  statusText: string
  contentType: string
  /** Decoded body text. */
  text: string
  byteLength: number
}

/** Charset from a Content-Type header, lower-cased, or undefined. */
export function charsetFromContentType(contentType: string): string | undefined {
  const match = /charset\s*=\s*"?([^;"\s]+)"?/i.exec(contentType || '')
  return match ? match[1].toLowerCase() : undefined
}

/**
 * Charset from the leading bytes of an HTML document: <meta charset> or the http-equiv form.
 * Only the first 2 KB are inspected, which is where the declaration is required to live.
 */
export function charsetFromHtml(head: string): string | undefined {
  const meta = /<meta[^>]+charset\s*=\s*["']?\s*([a-z0-9_\-:]+)/i.exec(head)
  if (meta) return meta[1].toLowerCase()
  const httpEquiv = /<meta[^>]+http-equiv\s*=\s*["']?content-type["']?[^>]*content\s*=\s*["'][^"']*charset\s*=\s*([a-z0-9_\-:]+)/i.exec(head)
  if (httpEquiv) return httpEquiv[1].toLowerCase()
  return undefined
}

/** Map the labels seen in the wild onto something TextDecoder accepts. */
function normalizeCharset(label: string | undefined): string {
  if (!label) return 'utf-8'
  const name = label.toLowerCase().replace(/^["']|["']$/g, '')
  if (name === 'gb2312' || name === 'gbk' || name === 'gb_2312-80') return 'gb18030'
  if (name === 'utf8') return 'utf-8'
  if (name === 'iso-8859-1' || name === 'latin1') return 'windows-1252'
  return name
}

function decode(bytes: Uint8Array, charset: string): string {
  try {
    return new TextDecoder(charset).decode(bytes)
  } catch {
    return new TextDecoder('utf-8').decode(bytes)
  }
}

/** Read the body, aborting once it grows past MAX_BODY_BYTES. */
async function readBodyLimited(response: Response): Promise<Uint8Array> {
  const declared = parseInt(response.headers.get('content-length') || '', 10)
  if (isFinite(declared) && declared > MAX_BODY_BYTES) {
    throw new WebFetchError(
      'The response is too large (' + Math.round(declared / (1024 * 1024)) + ' MB); the limit is 5 MB.'
    )
  }

  const body = response.body
  if (!body) return new Uint8Array(0)

  const reader = body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const step = await reader.read()
    if (step.done) break
    const chunk = step.value as Uint8Array
    total += chunk.length
    if (total > MAX_BODY_BYTES) {
      try {
        await reader.cancel()
      } catch {
        // The connection is going away anyway.
      }
      throw new WebFetchError('The response is larger than the 5 MB limit.')
    }
    chunks.push(chunk)
  }

  const merged = new Uint8Array(total)
  let offset = 0
  chunks.forEach((chunk) => {
    merged.set(chunk, offset)
    offset += chunk.length
  })
  return merged
}

/**
 * Fetch a URL, following up to MAX_REDIRECTS hops and guarding each one.
 * Throws WebFetchError for anything the model should be told about.
 */
export async function fetchRaw(url: string, acceptLanguage?: string): Promise<RawResponse> {
  let current = url
  let redirects = 0

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const guard = await guardUrl(current)
    if (!guard.ok) throw new WebFetchError(guard.reason || 'This URL cannot be fetched.')

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    let response: Response
    try {
      response = await fetch(current, {
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': USER_AGENT,
          Accept: ACCEPT,
          'Accept-Language': acceptLanguage || 'en-US,en;q=0.9'
        }
      })
    } catch (error: any) {
      clearTimeout(timer)
      if (error && error.name === 'AbortError') {
        throw new WebFetchError('The request timed out after 20 seconds.')
      }
      throw new WebFetchError('Could not reach the URL: ' + ((error && error.message) || 'network error') + '.')
    }

    // Manual redirect handling: the guard has to see the target before we follow it.
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      try {
        await response.body?.cancel()
      } catch {
        // ignore
      }
      clearTimeout(timer)

      if (!location) {
        throw new WebFetchError('The server answered ' + response.status + ' without a Location header.')
      }
      redirects++
      if (redirects > MAX_REDIRECTS) {
        throw new WebFetchError('Too many redirects (more than ' + MAX_REDIRECTS + ').')
      }
      current = new URL(location, current).toString()
      continue
    }

    try {
      const bytes = await readBodyLimited(response)
      const contentType = response.headers.get('content-type') || ''
      let charset = charsetFromContentType(contentType)
      if (!charset) {
        const head = new TextDecoder('utf-8').decode(bytes.slice(0, 2048))
        charset = charsetFromHtml(head)
      }
      const text = decode(bytes, normalizeCharset(charset))

      return {
        finalUrl: current,
        status: response.status,
        statusText: response.statusText,
        contentType,
        text,
        byteLength: bytes.length
      }
    } finally {
      clearTimeout(timer)
    }
  }
}
