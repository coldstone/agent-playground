/**
 * Turning a fetched body into the markdown the model reads.
 *
 * HTML goes through readability (main-content detection) and @mdream/js (markdown emission).
 * Article mode is preferred but not trusted blindly: on index and listing pages readability
 * happily returns three sentences, so the article is only used when it is a meaningful share of
 * the whole page. JSON is pretty-printed, text passes through, binaries are refused.
 */
import { parseHTML } from 'linkedom'
import { Readability, isProbablyReaderable } from '@mozilla/readability'
import { htmlToMarkdown } from '@mdream/js'
import { withMinimalPreset } from '@mdream/js/preset/minimal'
import { WebFetchError } from './fetch'

export type FetchMode = 'article' | 'full' | 'raw'
export type ExtractedKind = 'article' | 'full' | 'full-fallback' | 'raw' | 'json' | 'text'

export interface ExtractInput {
  url: string
  contentType: string
  text: string
  byteLength: number
  mode: FetchMode
}

export interface ExtractOutput {
  content: string
  extracted: ExtractedKind
  title?: string
  description?: string
  siteName?: string
  lang?: string
}

/** Article mode falls back to the full page below this many characters. */
const MIN_ARTICLE_CHARS = 400
/**
 * ...or below this share of the full-page markdown. Measured across article and index pages:
 * real articles land between 0.50 (ruanyifeng) and 0.95 (MDN), while the BBC News front page -
 * where readability keeps only the first few headlines - lands at 0.23.
 */
const MIN_ARTICLE_RATIO = 0.35

/** Below this share of the unfiltered conversion, the minimal preset is assumed to have failed. */
const MIN_PRESET_RATIO = 0.15
const MIN_PRESET_CHARS = 200

/** A decoded body containing this byte is not text, whatever the headers claim. */
const NUL = String.fromCharCode(0)

function mimeOf(contentType: string): string {
  return (contentType || '').split(';')[0].trim().toLowerCase()
}

export function looksLikeHtml(mime: string, text: string): boolean {
  if (mime === 'text/html' || mime === 'application/xhtml+xml') return true
  if (mime) return false
  return /^\s*(<!doctype\s+html|<html\b)/i.test(text.slice(0, 500))
}

export function isJsonMime(mime: string): boolean {
  return mime === 'application/json' || /\+json$/.test(mime)
}

export function isTextMime(mime: string): boolean {
  if (mime.indexOf('text/') === 0) return true
  if (mime === 'application/xml' || /\+xml$/.test(mime)) return true
  return mime === 'application/javascript' || mime === 'application/x-ndjson'
}

/** Collapse runs of blank lines and trim, so the model does not pay for whitespace. */
export function normalizeMarkdown(markdown: string): string {
  return markdown.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

function collapse(value: string | null | undefined): string | undefined {
  if (!value) return undefined
  const cleaned = value.replace(/\s+/g, ' ').trim()
  return cleaned || undefined
}

function metaContent(document: any, selector: string): string | undefined {
  try {
    const node = document.querySelector(selector)
    return collapse(node && node.getAttribute('content'))
  } catch {
    return undefined
  }
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  if (bytes >= 1024) return Math.round(bytes / 1024) + ' KB'
  return bytes + ' B'
}

/**
 * The minimal preset (isolateMain + nav/footer filtering) is what makes full mode cheap, but its
 * main-content detection picks the wrong node on table-layout pages - it reduces the Hacker News
 * front page to the 11 characters of its title. So when the filtered output is a tiny fraction of
 * the unfiltered one, fall back to a plain clean conversion of the whole document.
 *
 * The second conversion only runs when the full page is actually returned, not for the length
 * comparison article mode does.
 */
function toPresetMarkdown(html: string, url: string): string {
  return normalizeMarkdown(
    htmlToMarkdown(html, withMinimalPreset({ origin: url, plugins: { frontmatter: false } }))
  )
}

function repairFullMarkdown(presetMarkdown: string, html: string, url: string): string {
  const plain = normalizeMarkdown(htmlToMarkdown(html, { origin: url, clean: true }))
  const enough =
    presetMarkdown.length >= Math.max(MIN_PRESET_CHARS, MIN_PRESET_RATIO * plain.length)
  return enough ? presetMarkdown : plain
}

function extractHtml(input: ExtractInput): ExtractOutput {
  const { text: html, url, mode } = input

  if (mode === 'raw') {
    return { content: html, extracted: 'raw' }
  }

  // Metadata comes off the document before readability mutates it.
  const { document } = parseHTML(html)
  const documentTitle = collapse(document.title)
  const ogTitle = metaContent(document, 'meta[property="og:title"]')
  const metaDescription =
    metaContent(document, 'meta[name="description"]') ||
    metaContent(document, 'meta[property="og:description"]')
  const ogSiteName = metaContent(document, 'meta[property="og:site_name"]')
  const documentLang = collapse(
    (document.documentElement && document.documentElement.getAttribute('lang')) || undefined
  )

  const presetMarkdown = toPresetMarkdown(html, url)

  if (mode === 'full') {
    return {
      content: repairFullMarkdown(presetMarkdown, html, url),
      extracted: 'full',
      title: ogTitle || documentTitle,
      description: metaDescription,
      siteName: ogSiteName,
      lang: documentLang
    }
  }

  // Article mode. isProbablyReaderable is cheap and runs before the expensive parse.
  let readerable = false
  try {
    readerable = isProbablyReaderable(document)
  } catch {
    readerable = false
  }

  let article: any = null
  if (readerable) {
    try {
      // Readability mutates the document; nothing else may use it afterwards.
      article = new Readability(document).parse()
    } catch {
      article = null
    }
  }

  const articleMarkdown =
    article && article.content
      ? normalizeMarkdown(htmlToMarkdown(article.content, { origin: url, clean: true }))
      : ''

  const longEnough =
    articleMarkdown.length >= Math.max(MIN_ARTICLE_CHARS, MIN_ARTICLE_RATIO * presetMarkdown.length)

  if (article && longEnough) {
    return {
      content: articleMarkdown,
      extracted: 'article',
      title: collapse(article.title) || ogTitle || documentTitle,
      description: metaDescription || collapse(article.excerpt),
      siteName: collapse(article.siteName) || ogSiteName,
      lang: collapse(article.lang) || documentLang
    }
  }

  return {
    content: repairFullMarkdown(presetMarkdown, html, url),
    extracted: 'full-fallback',
    title: ogTitle || documentTitle,
    description: metaDescription,
    siteName: ogSiteName,
    lang: documentLang
  }
}

export function extractContent(input: ExtractInput): ExtractOutput {
  const mime = mimeOf(input.contentType)

  if (mime === 'application/pdf') {
    throw new WebFetchError('PDF is not supported yet (' + formatBytes(input.byteLength) + ').')
  }

  if (looksLikeHtml(mime, input.text)) {
    return extractHtml(input)
  }

  if (input.mode === 'raw') {
    return { content: input.text, extracted: 'raw' }
  }

  if (isJsonMime(mime)) {
    try {
      return { content: JSON.stringify(JSON.parse(input.text), null, 2), extracted: 'json' }
    } catch {
      return { content: input.text.trim(), extracted: 'json' }
    }
  }

  if (isTextMime(mime)) {
    return { content: input.text.trim(), extracted: 'text' }
  }

  // Unknown type but the body decoded without NUL bytes: treat it as text rather than refusing,
  // since plenty of servers send textual content with no Content-Type at all.
  const looksBinary = input.text.slice(0, 1000).indexOf(NUL) >= 0
  if (!mime && !looksBinary && input.text.trim()) {
    return { content: input.text.trim(), extracted: 'text' }
  }

  throw new WebFetchError(
    'This content type cannot be read as text: ' + (mime || 'unknown') + ' (' + formatBytes(input.byteLength) + ').'
  )
}
