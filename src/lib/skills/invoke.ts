/**
 * Explicit skill invocation: typing `/skill-name [request]` injects the skill instructions into
 * the outgoing message, so the model never has to decide whether to call `load_skill` first.
 */
import { Skill } from '@/types'
import { buildSkillContentBlock } from './execute'
import { getEnabledSkills } from './prompt'

export interface SkillInvocation {
  skill: Skill
  /** Whatever the user typed after the skill name. */
  rest: string
}

/** `/name` at the very start of the message, optionally followed by the actual request. */
const INVOCATION_PATTERN = /^\/([a-z0-9-]+)\b[ \t]*([\s\S]*)$/i

/**
 * Parse `/skill-name [request]`. Returns null when the message does not start with a slash or
 * the name does not match an enabled skill, so ordinary messages beginning with "/" are sent
 * unchanged.
 */
export function parseSkillInvocation(input: string, skills: Skill[]): SkillInvocation | null {
  const text = (input || '').replace(/^\s+/, '')
  const match = INVOCATION_PATTERN.exec(text)
  if (!match) return null

  const typed = match[1].toLowerCase()
  const enabled = getEnabledSkills(skills)
  const skill = enabled.filter((candidate) => candidate.name.toLowerCase() === typed)[0]
  if (!skill) return null

  return { skill, rest: (match[2] || '').trim() }
}

/**
 * Build the message actually sent to the model: the skill block followed by the user's request.
 * Without a request, a one-line instruction keeps the turn actionable.
 */
export function buildSkillInvocationMessage(skill: Skill, rest: string, resources: string[]): string {
  const request = (rest || '').trim() || 'Follow the instructions of the "' + skill.name + '" skill.'
  const block = buildSkillContentBlock(skill, resources)
  // The skill is already in the message; without this the model still spends a turn on load_skill
  const withNote = block.replace(
    /\n<\/skill_content>$/,
    '\nThis skill is already loaded; do not call load_skill for it - read referenced files with read_skill_file when needed.\n</skill_content>'
  )
  return withNote + '\n\n' + request
}

/** Enabled skills whose name starts with the typed prefix, for the `/` autocomplete. */
export function matchSkillPrefix(prefix: string, skills: Skill[]): Skill[] {
  const lower = (prefix || '').toLowerCase()
  return getEnabledSkills(skills)
    .filter((skill) => skill.name.toLowerCase().indexOf(lower) === 0)
    .sort((a, b) => a.name.localeCompare(b.name))
}
