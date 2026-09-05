/**
 * Repairs double-encoded UTF-8 ("mojibake") in text coming from MCP servers.
 *
 * Runs only inside Next.js API routes (Node.js) — it relies on Buffer.
 *
 * Some servers emit UTF-8 bytes that were then re-encoded as if they had been Latin-1,
 * so a string whose UTF-8 bytes are E9 80 9A E8 BF 87 ("通过") arrives as six separate
 * Latin-1 characters instead of two Chinese ones.
 * Mapping the string back to bytes through Latin-1 and decoding it as UTF-8 undoes that.
 */

const MOJIBAKE_PATTERN = /[\u00C2-\u00F4][\u0080-\u00BF]/
const utf8Decoder = new TextDecoder('utf-8', { fatal: true })

/**
 * Return `value` with its double-encoded parts decoded back to real Unicode.
 *
 * Servers often mangle only some of a string: a long description can hold correct Chinese
 * next to a single double-encoded em dash. So the repair works per segment rather than on
 * the string as a whole. `value` is cut into maximal runs of characters at or below U+00FF
 * (candidates, since a Latin-1 round trip can only produce those) and runs of anything
 * above it (real Unicode, copied verbatim). Each candidate run is repaired on its own and
 * the pieces are joined back together, so whole-string mojibake still round-trips as one
 * single run.
 *
 * The test applied to a run is deliberately conservative, because a false positive would
 * corrupt legitimate text:
 * 1. The run must contain a UTF-8 lead byte (U+00C2-U+00F4) immediately followed by a
 *    continuation byte (U+0080-U+00BF) — the signature of a multi-byte sequence that was
 *    expanded into individual characters. Runs without it are kept as they are.
 * 2. The run's Latin-1 bytes must decode as strictly valid UTF-8. Text that merely happens
 *    to match the pattern (e.g. genuine Latin-1 punctuation) fails this check and is kept.
 */
export function repairMojibake(value: string): string {
  if (!value || !MOJIBAKE_PATTERN.test(value)) return value

  let result = ''
  let index = 0
  while (index < value.length) {
    const isLatin1 = value.charCodeAt(index) <= 0xff
    let end = index + 1
    while (end < value.length && value.charCodeAt(end) <= 0xff === isLatin1) end++

    const run = value.slice(index, end)
    result += isLatin1 ? repairLatin1Run(run) : run
    index = end
  }
  return result
}

/** Decode one all-Latin-1 run if it looks double-encoded, otherwise return it unchanged. */
function repairLatin1Run(run: string): string {
  if (!MOJIBAKE_PATTERN.test(run)) return run
  try {
    return utf8Decoder.decode(Buffer.from(run, 'latin1'))
  } catch {
    // Not valid UTF-8 once mapped back to bytes: this run was not double-encoded.
    return run
  }
}

/**
 * Apply `repairMojibake` to every string reachable through plain objects and arrays.
 * The input is never mutated; new containers are returned. Non-plain objects (Date, Map,
 * class instances, ...) are passed through untouched.
 */
export function deepRepairMojibake<T>(value: T): T {
  if (typeof value === 'string') return repairMojibake(value) as unknown as T

  if (Array.isArray(value)) {
    return value.map((item) => deepRepairMojibake(item)) as unknown as T
  }

  if (isPlainObject(value)) {
    const result: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value)) {
      result[key] = deepRepairMojibake(item)
    }
    return result as unknown as T
  }

  return value
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}
