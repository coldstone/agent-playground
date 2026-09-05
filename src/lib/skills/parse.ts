/**
 * SKILL.md parsing: split the YAML frontmatter from the Markdown body.
 *
 * Browser-safe: no Node APIs, only the `yaml` package.
 */
import { parse as parseYaml } from 'yaml'

export interface ParsedSkillMarkdown {
  frontmatter: Record<string, unknown>
  body: string
  frontmatterRaw: string
  errors: string[]
}

const FRONTMATTER_FENCE = '---'

/**
 * Wrap unquoted scalar values that contain ": " in double quotes.
 *
 * This is the lenient rule from the agentskills.io client guide: authors routinely write
 * `description: Use this when: the user asks ...`, which is not valid YAML because the second
 * colon starts a nested mapping. Only lines that look like `key: value` at the top level are
 * touched, and only when the value is not already quoted and is not a block scalar or a
 * flow collection.
 */
function quoteUnquotedColonValues(raw: string): string {
  const lines = raw.split('\n')
  const fixed = lines.map((line) => {
    const match = /^([A-Za-z0-9_-]+):[ \t]+(.*)$/.exec(line)
    if (!match) return line

    const value = match[2]
    if (value.length === 0) return line

    const first = value.charAt(0)
    // Already quoted, a block scalar, a flow collection, a comment or an anchor: leave it alone
    if (first === '"' || first === "'" || first === '|' || first === '>' || first === '[' || first === '{' || first === '#' || first === '&' || first === '*') {
      return line
    }
    if (value.indexOf(': ') === -1 && !/:$/.test(value)) return line

    return match[1] + ': "' + value.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'
  })
  return fixed.join('\n')
}

function toRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

/**
 * Parse a SKILL.md file. The frontmatter is the YAML block between a `---` on the very first
 * line and the next `---` on its own line; everything after it is the body.
 *
 * A file without frontmatter is not an error here — validation decides what is fatal.
 */
export function parseSkillMarkdown(raw: string): ParsedSkillMarkdown {
  const errors: string[] = []
  // Normalize line endings so CRLF files behave like LF ones, and drop a BOM
  const text = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = text.split('\n')

  if (lines[0] !== FRONTMATTER_FENCE) {
    return {
      frontmatter: {},
      body: text.trim(),
      frontmatterRaw: '',
      errors: ['No YAML frontmatter found: the file does not start with "---"']
    }
  }

  let closingIndex = -1
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === FRONTMATTER_FENCE) {
      closingIndex = i
      break
    }
  }

  if (closingIndex === -1) {
    return {
      frontmatter: {},
      body: text.trim(),
      frontmatterRaw: '',
      errors: ['Unterminated YAML frontmatter: no closing "---" found']
    }
  }

  const frontmatterRaw = lines.slice(1, closingIndex).join('\n')
  const body = lines.slice(closingIndex + 1).join('\n').trim()

  let frontmatter: Record<string, unknown> = {}
  try {
    frontmatter = toRecord(parseYaml(frontmatterRaw))
  } catch (error) {
    // Lenient retry: the most common authoring mistake is an unquoted value with a colon
    const message = error instanceof Error ? error.message : String(error)
    try {
      frontmatter = toRecord(parseYaml(quoteUnquotedColonValues(frontmatterRaw)))
      errors.push('YAML frontmatter was repaired: unquoted values containing ":" were quoted (' + message.split('\n')[0] + ')')
    } catch (retryError) {
      const retryMessage = retryError instanceof Error ? retryError.message : String(retryError)
      errors.push('Failed to parse YAML frontmatter: ' + retryMessage.split('\n')[0])
    }
  }

  return { frontmatter, body, frontmatterRaw, errors }
}
