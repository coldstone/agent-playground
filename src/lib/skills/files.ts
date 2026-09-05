/**
 * File helpers for the per-skill virtual file system: path normalization, text/binary
 * detection, MIME guessing and the import limits.
 *
 * Browser-safe: no Node APIs.
 */

export const SKILL_LIMITS = {
  /** Text files above this are rejected; the model could not read them anyway. */
  maxTextFileBytes: 2 * 1024 * 1024,
  /** Binary files above this are rejected; they are only listed, never read. */
  maxBinaryFileBytes: 10 * 1024 * 1024,
  /** Total size of one skill. */
  maxSkillBytes: 50 * 1024 * 1024,
  /** Number of files in one skill. */
  maxFiles: 500
}

/** Extensions that are always treated as text, whatever the bytes look like. */
const TEXT_EXTENSIONS: Record<string, boolean> = {
  md: true, txt: true, json: true, yaml: true, yml: true, csv: true, tsv: true,
  xml: true, html: true, css: true, js: true, jsx: true, ts: true, tsx: true,
  py: true, sh: true, bash: true, rb: true, go: true, rs: true, java: true,
  kt: true, swift: true, c: true, cpp: true, h: true, toml: true, ini: true,
  cfg: true, env: true, sql: true, graphql: true
}

const MIME_TYPES: Record<string, string> = {
  md: 'text/markdown', txt: 'text/plain', json: 'application/json',
  yaml: 'application/yaml', yml: 'application/yaml', csv: 'text/csv',
  tsv: 'text/tab-separated-values', xml: 'application/xml', html: 'text/html',
  css: 'text/css', js: 'text/javascript', jsx: 'text/javascript',
  ts: 'text/typescript', tsx: 'text/typescript', py: 'text/x-python',
  sh: 'application/x-sh', bash: 'application/x-sh', rb: 'text/x-ruby',
  go: 'text/x-go', rs: 'text/x-rust', java: 'text/x-java', kt: 'text/x-kotlin',
  swift: 'text/x-swift', c: 'text/x-c', cpp: 'text/x-c', h: 'text/x-c',
  toml: 'application/toml', ini: 'text/plain', cfg: 'text/plain',
  env: 'text/plain', sql: 'application/sql', graphql: 'application/graphql',
  pdf: 'application/pdf', zip: 'application/zip', png: 'image/png',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml',
  webp: 'image/webp', ico: 'image/x-icon', mp3: 'audio/mpeg', mp4: 'video/mp4',
  wav: 'audio/wav', woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf'
}

/** How many bytes of a file are inspected when sniffing text vs binary. */
const SNIFF_BYTES = 8 * 1024

function extensionOf(path: string): string {
  const name = path.substring(path.lastIndexOf('/') + 1)
  const dot = name.lastIndexOf('.')
  if (dot <= 0) return ''
  return name.substring(dot + 1).toLowerCase()
}

/**
 * Normalize an import path to the form stored in `skill-files`: posix separators, relative to
 * the skill root, no `.` or `..` segments.
 *
 * Returns an empty string when the path escapes the skill root or is empty.
 */
export function normalizeSkillPath(path: string): string {
  const raw = String(path || '').replace(/\\/g, '/').trim()
  if (!raw) return ''

  const segments = raw.split('/')
  const result: string[] = []
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    if (!segment || segment === '.') continue
    if (segment === '..') return '' // Never allow a path to leave the skill directory
    result.push(segment)
  }

  return result.join('/')
}

/**
 * Paths that are never imported: version control and dependency directories, macOS metadata,
 * and any hidden segment (a leading dot) so editor and tooling state stays out of the skill.
 */
export function shouldSkipPath(path: string): boolean {
  const normalized = normalizeSkillPath(path)
  if (!normalized) return true

  const segments = normalized.split('/')
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    if (segment.charAt(0) === '.') return true // .git, .DS_Store, .env, .vscode, ...
    if (segment === 'node_modules') return true
    if (segment === '__pycache__') return true
  }

  return false
}

export function guessMimeType(path: string): string {
  const known = MIME_TYPES[extensionOf(path)]
  if (known) return known
  return isTextFile(path) ? 'text/plain' : 'application/octet-stream'
}

/** Valid UTF-8 without NUL bytes is treated as text. */
function looksLikeUtf8Text(bytes: Uint8Array): boolean {
  const length = Math.min(bytes.length, SNIFF_BYTES)
  for (let i = 0; i < length; i++) {
    if (bytes[i] === 0) return false
  }

  if (typeof TextDecoder === 'undefined') return true

  try {
    // Decode a whole number of bytes; a multi-byte character cut by the sniff window would
    // otherwise be reported as invalid, so only fail on errors inside the window.
    new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, length))
    return true
  } catch {
    if (length < bytes.length) {
      // The window may have split a character: retry a slightly shorter slice before giving up
      const shorter = Math.max(0, length - 4)
      try {
        new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, shorter))
        return true
      } catch {
        return false
      }
    }
    return false
  }
}

/**
 * Decide whether a file is stored as text (readable by the model) or as a blob (listed only).
 *
 * The extension allow-list wins; for everything else the bytes are sniffed when available.
 * Without bytes, an unknown extension is treated as binary.
 */
export function isTextFile(path: string, bytes?: Uint8Array): boolean {
  if (TEXT_EXTENSIONS[extensionOf(path)]) return true
  if (!bytes) return false
  return looksLikeUtf8Text(bytes)
}
