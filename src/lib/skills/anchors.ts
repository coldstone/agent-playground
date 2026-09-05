/**
 * Heading anchors for rendered skill markdown.
 *
 * The shared markdown renderer emits no heading ids, so the skill viewer assigns them itself to
 * make `#fragment` links inside a skill work. The slugs follow the GitHub convention closely
 * enough that hand-written tables of contents resolve.
 */

/** Letters and digits are kept; CJK and other scripts count as letters. */
function isSlugCharacter(character: string): boolean {
  if (character >= '0' && character <= '9') return true
  if (character >= 'a' && character <= 'z') return true
  if (character >= 'A' && character <= 'Z') return true
  if (character.charCodeAt(0) < 128) return false

  // Non-ASCII: cased scripts change case, uncased ones (CJK, Hangul, ...) do not. Punctuation
  // and symbol blocks are excluded explicitly so "第一节。" does not keep its full stop.
  if (character.toLowerCase() !== character.toUpperCase()) return true
  return !/[\s\u00A0\u2000-\u206F\u2190-\u2BFF\u3000-\u303F\uFE30-\uFE4F\uFF00-\uFF0F\uFF1A-\uFF20\uFF3B-\uFF40\uFF5B-\uFF65]/.test(character)
}

/**
 * GitHub-style slug: lowercased, punctuation dropped, whitespace collapsed into single hyphens.
 * "Form PDF (AcroForm)" becomes "form-pdf-acroform".
 */
export function slugifyHeading(text: string): string {
  const source = String(text || '').trim().toLowerCase()

  let slug = ''
  for (let i = 0; i < source.length; i++) {
    const character = source.charAt(i)
    if (/\s/.test(character)) {
      slug += '-'
    } else if (character === '-' || isSlugCharacter(character)) {
      slug += character
    }
  }

  return slug.replace(/-+/g, '-').replace(/^-+/, '').replace(/-+$/, '')
}

/**
 * Slug for one heading, disambiguated against the headings already seen in document order:
 * the first "Metadata" keeps `metadata`, the next becomes `metadata-1`, and so on.
 */
export function uniqueHeadingSlug(text: string, used: Record<string, number>): string {
  const base = slugifyHeading(text)
  if (!base) return ''

  const seen = used[base] || 0
  used[base] = seen + 1
  return seen === 0 ? base : base + '-' + seen
}
