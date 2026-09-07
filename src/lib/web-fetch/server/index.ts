/**
 * Entry point of the server-side web_fetch pipeline: guard, fetch, convert, cache, chunk.
 * Imported only from src/app/api/fetch/route.ts - none of this is safe in the browser bundle.
 */
import { fetchRaw, WebFetchError } from './fetch'
import { extractContent, ExtractedKind, FetchMode } from './extract'
import { getCachedPage, setCachedPage, CachedPage } from './cache'

export * from './guard'
export * from './fetch'
export * from './extract'
export * from './cache'

export const DEFAULT_MAX_LENGTH = 20000
export const MIN_MAX_LENGTH = 1000
export const MAX_MAX_LENGTH = 100000

export interface WebFetchInput {
  url: string
  mode?: FetchMode
  maxLength?: number
  startIndex?: number
  acceptLanguage?: string
}

export interface WebFetchResult {
  url: string
  finalUrl: string
  status: number
  contentType: string
  title?: string
  description?: string
  siteName?: string
  lang?: string
  extracted: ExtractedKind
  totalLength: number
  startIndex: number
  endIndex: number
  truncated: boolean
  content: string
  cached: boolean
}

export function normalizeMode(mode: unknown): FetchMode {
  return mode === 'full' || mode === 'raw' ? mode : 'article'
}

export function clampMaxLength(value: unknown): number {
  const numeric = typeof value === 'number' ? value : parseInt(String(value), 10)
  if (!isFinite(numeric)) return DEFAULT_MAX_LENGTH
  return Math.min(MAX_MAX_LENGTH, Math.max(MIN_MAX_LENGTH, Math.floor(numeric)))
}

export function clampStartIndex(value: unknown, total: number): number {
  const numeric = typeof value === 'number' ? value : parseInt(String(value), 10)
  if (!isFinite(numeric) || numeric <= 0) return 0
  return Math.min(Math.floor(numeric), total)
}

/**
 * Slice [start, start + maxLength). When the cut lands mid-line and a newline exists in the last
 * fifth of the slice, back up to it so the model never gets half a sentence or half a table row.
 */
export function chunkContent(
  content: string,
  startIndex: number,
  maxLength: number
): { text: string; endIndex: number; truncated: boolean } {
  const total = content.length
  const start = Math.min(Math.max(startIndex, 0), total)

  if (start + maxLength >= total) {
    return { text: content.slice(start), endIndex: total, truncated: false }
  }

  let end = start + maxLength
  const slice = content.slice(start, end)
  const lastNewline = slice.lastIndexOf('\n')
  if (lastNewline > maxLength * 0.8) {
    end = start + lastNewline + 1
  }

  return { text: content.slice(start, end), endIndex: end, truncated: end < total }
}

export async function fetchUrlContent(input: WebFetchInput): Promise<WebFetchResult> {
  const mode = normalizeMode(input.mode)
  const maxLength = clampMaxLength(input.maxLength)

  let page = getCachedPage(mode, input.url)
  let cached = true

  if (!page) {
    cached = false
    const raw = await fetchRaw(input.url, input.acceptLanguage)

    if (raw.status >= 400) {
      // Strip script and style bodies first: error pages often start with inline CSS, and a
      // naive tag strip would hand the model 500 characters of stylesheet instead of the message.
      const preview = raw.text
        .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 500)
      throw new WebFetchError(
        'The server answered ' + raw.status + ' ' + (raw.statusText || '') + '.' +
          (preview ? ' Response: ' + preview : ''),
        raw.status
      )
    }

    const extracted = extractContent({
      url: raw.finalUrl,
      contentType: raw.contentType,
      text: raw.text,
      byteLength: raw.byteLength,
      mode
    })

    const value: CachedPage = {
      ...extracted,
      finalUrl: raw.finalUrl,
      status: raw.status,
      contentType: raw.contentType
    }
    setCachedPage(mode, input.url, value)
    page = value
  }

  const total = page.content.length
  const startIndex = clampStartIndex(input.startIndex, total)
  const chunk = chunkContent(page.content, startIndex, maxLength)

  return {
    url: input.url,
    finalUrl: page.finalUrl,
    status: page.status,
    contentType: page.contentType,
    title: page.title,
    description: page.description,
    siteName: page.siteName,
    lang: page.lang,
    extracted: page.extracted,
    totalLength: total,
    startIndex,
    endIndex: chunk.endIndex,
    truncated: chunk.truncated,
    content: chunk.text,
    cached
  }
}
