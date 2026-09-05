/**
 * Lenient validation of SKILL.md frontmatter.
 *
 * The client-implementation guide asks for tolerance: only a missing description makes a skill
 * unusable (the catalog entry would say nothing), everything else is reported as a warning and
 * the skill is still imported.
 */

/** Spec rule for `name`: lowercase letters, digits and single hyphens. */
export const SKILL_NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/

export const SKILL_NAME_MAX_LENGTH = 64
export const SKILL_DESCRIPTION_MAX_LENGTH = 1024
export const SKILL_COMPATIBILITY_MAX_LENGTH = 500

export interface ValidatedSkillFrontmatter {
  name: string
  description: string
  license?: string
  compatibility?: string
  metadata?: Record<string, string>
  allowedTools?: string
  warnings: string[]
  /** Set when the skill cannot be used at all; the caller should refuse the import. */
  fatal?: string
}

function asTrimmedString(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

/** Frontmatter `metadata` is a string map; coerce scalars and drop anything else. */
function coerceMetadata(value: unknown, warnings: string[]): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    if (value !== undefined && value !== null) {
      warnings.push('metadata is not a mapping and was ignored')
    }
    return undefined
  }

  const source = value as Record<string, unknown>
  const result: Record<string, string> = {}
  Object.keys(source).forEach((key) => {
    const entry = source[key]
    if (entry === null || entry === undefined) return
    if (typeof entry === 'object') {
      result[key] = JSON.stringify(entry)
      return
    }
    result[key] = String(entry)
  })

  return Object.keys(result).length > 0 ? result : undefined
}

/**
 * Validate parsed frontmatter against the skill spec.
 *
 * `folderName` is the directory the SKILL.md came from; it is both the fallback name and the
 * value `name` is supposed to match.
 */
export function validateSkill(
  frontmatter: Record<string, unknown>,
  folderName?: string
): ValidatedSkillFrontmatter {
  const warnings: string[] = []

  const description = asTrimmedString(frontmatter.description)
  let name = asTrimmedString(frontmatter.name)

  if (!name) {
    if (folderName) {
      name = folderName
      warnings.push('Frontmatter has no "name"; using the folder name "' + folderName + '"')
    } else {
      warnings.push('Frontmatter has no "name" and no folder name was available')
    }
  }

  if (name) {
    if (name.length > SKILL_NAME_MAX_LENGTH) {
      warnings.push('Name is longer than ' + SKILL_NAME_MAX_LENGTH + ' characters')
    }
    if (!SKILL_NAME_PATTERN.test(name)) {
      warnings.push('Name "' + name + '" does not match the spec pattern (lowercase letters, digits and single hyphens)')
    }
    if (folderName && name !== folderName) {
      warnings.push('Name "' + name + '" does not match the folder name "' + folderName + '"')
    }
  }

  if (!description) {
    return {
      name,
      description: '',
      warnings,
      fatal: 'Frontmatter is missing a "description"; the skill cannot be offered to the model'
    }
  }

  if (description.length > SKILL_DESCRIPTION_MAX_LENGTH) {
    warnings.push('Description is longer than ' + SKILL_DESCRIPTION_MAX_LENGTH + ' characters')
  }

  const license = asTrimmedString(frontmatter.license) || undefined
  const compatibility = asTrimmedString(frontmatter.compatibility) || undefined
  if (compatibility && compatibility.length > SKILL_COMPATIBILITY_MAX_LENGTH) {
    warnings.push('Compatibility is longer than ' + SKILL_COMPATIBILITY_MAX_LENGTH + ' characters')
  }

  // The spec spells it `allowed-tools`; accept the camelCase spelling too
  const allowedTools =
    asTrimmedString(frontmatter['allowed-tools']) || asTrimmedString(frontmatter.allowedTools) || undefined

  return {
    name,
    description,
    license,
    compatibility,
    metadata: coerceMetadata(frontmatter.metadata, warnings),
    allowedTools,
    warnings
  }
}
