/**
 * Tier 1 of progressive disclosure: the skill catalog that goes into the system prompt.
 *
 * Only names and descriptions are listed (~50-100 tokens per skill). The model loads the body
 * of a skill with `load_skill` when a task matches, and reads bundled files one at a time.
 */
import { Skill } from '@/types'

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function getEnabledSkills(skills: Skill[]): Skill[] {
  return (skills || []).filter((skill) => skill.enabled && !!skill.description)
}

/**
 * Build the `# Skills` block. Returns an empty string when no skill is offered, so the catalog
 * is omitted entirely instead of telling the model about tools it does not have.
 */
export function buildSkillsPrompt(skills: Skill[]): string {
  const enabled = getEnabledSkills(skills)
  if (enabled.length === 0) return ''

  const entries = enabled.map(
    (skill) =>
      '  <skill><name>' + escapeXml(skill.name) + '</name><description>' + escapeXml(skill.description) + '</description></skill>'
  )

  return [
    '# Skills',
    "The following skills provide specialized instructions for specific tasks. When a task matches a",
    "skill's description, call `load_skill` with the skill's name before proceeding, then follow the",
    'instructions it returns. Skills may reference files by relative path; read them with `read_skill_file`',
    '(text only) and browse them with `list_skill_files`. Scripts bundled with a skill cannot be executed',
    'in this environment - read them and reproduce the logic or ask the user instead.',
    '<available_skills>',
    entries.join('\n'),
    '</available_skills>'
  ].join('\n')
}

/**
 * Append the catalog to a system prompt. When the base prompt is empty the catalog becomes the
 * whole system prompt, so a session without any custom prompt still sees the skills.
 */
export function appendSkillsPrompt(systemPrompt: string, skills: Skill[]): string {
  const block = buildSkillsPrompt(skills)
  if (!block) return systemPrompt
  const base = (systemPrompt || '').trim()
  return base ? base + '\n\n' + block : block
}
