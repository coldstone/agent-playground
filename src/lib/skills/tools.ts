/**
 * Tiers 2 and 3 of progressive disclosure: the built-in tools that let the model pull a skill's
 * instructions and its bundled files into the conversation.
 *
 * These tools are generated from the enabled skills (like MCP tools) and executed inside the
 * page — they never touch the network. The `enum` on the skill parameters keeps the model from
 * inventing names.
 */
import { Skill, Tool } from '@/types'
import { SkillToolBinding } from '@/types'
import { getEnabledSkills } from './prompt'

export type SkillToolKind = SkillToolBinding['kind']

export const SKILL_TOOL_ID_PREFIX = 'builtin:'

export function skillToolId(kind: SkillToolKind): string {
  return SKILL_TOOL_ID_PREFIX + kind
}

export function isSkillTool(tool: Tool | undefined | null): tool is Tool & { builtin: SkillToolBinding } {
  return !!tool && !!tool.builtin
}

function makeTool(
  kind: SkillToolKind,
  description: string,
  properties: Record<string, unknown>,
  required: string[],
  now: number
): Tool {
  return {
    id: skillToolId(kind),
    name: kind,
    description,
    schema: {
      type: 'function',
      function: {
        name: kind,
        description,
        parameters: {
          type: 'object',
          properties,
          required
        }
      }
    },
    builtin: { kind },
    tag: 'Skills',
    createdAt: now,
    updatedAt: now
  }
}

/**
 * Build the four skill tools for the currently enabled skills. Returns an empty array when no
 * skill is offered, so nothing skill-related is sent to the model in that case.
 */
export function buildSkillTools(skills: Skill[]): Tool[] {
  const enabled = getEnabledSkills(skills)
  if (enabled.length === 0) return []

  const names = enabled.map((skill) => skill.name)
  const now = Date.now()

  return [
    makeTool(
      'load_skill',
      'Load the full instructions of a skill. Call this first, before doing the work, whenever a task matches one of the skills listed in the system prompt. Returns the skill body plus the list of files bundled with it; read those files with read_skill_file only when the instructions point at them.',
      {
        name: {
          type: 'string',
          description: 'Name of the skill to load.',
          enum: names
        }
      },
      ['name'],
      now
    ),
    makeTool(
      'read_skill_file',
      'Read one text file bundled with a skill. Paths are relative to the skill directory, exactly as written in the skill instructions (for example "references/REFERENCE.md"). Long files are returned in pages; call again with start_line to continue. Bundled scripts cannot be executed here - read them and reproduce the logic instead.',
      {
        skill: {
          type: 'string',
          description: 'Name of the skill the file belongs to.',
          enum: names
        },
        path: {
          type: 'string',
          description: 'File path relative to the skill directory, e.g. "references/REFERENCE.md".'
        },
        start_line: {
          type: 'integer',
          description: 'Optional 1-based first line to return.'
        },
        end_line: {
          type: 'integer',
          description: 'Optional 1-based last line to return (inclusive).'
        }
      },
      ['skill', 'path'],
      now
    ),
    makeTool(
      'list_skill_files',
      'List the files bundled with a skill, with their sizes. Use it to discover what a skill ships when the instructions mention a directory rather than a specific file.',
      {
        skill: {
          type: 'string',
          description: 'Name of the skill to list.',
          enum: names
        },
        dir: {
          type: 'string',
          description: 'Optional subdirectory relative to the skill directory, e.g. "references".'
        }
      },
      ['skill'],
      now
    ),
    makeTool(
      'search_skill_files',
      'Search the text files of a skill and return matching lines with their path and line number. Use it to find the relevant part of a long reference instead of reading the whole file.',
      {
        skill: {
          type: 'string',
          description: 'Name of the skill to search.',
          enum: names
        },
        query: {
          type: 'string',
          description: 'Plain text to look for (case-insensitive). A regular expression is also accepted.'
        },
        glob: {
          type: 'string',
          description: 'Optional path filter, e.g. "references/**" or "*.md".'
        }
      },
      ['skill', 'query'],
      now
    )
  ]
}
