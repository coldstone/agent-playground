/**
 * In-page execution of the built-in skill tools.
 *
 * Everything runs against the IndexedDB copy of the skill; no network, no filesystem, no shell.
 * Bundled scripts are readable but never executed, and the results say so.
 */
import { Skill, SkillFileRecord } from '@/types'
import { normalizeSkillPath } from './files'
import { getEnabledSkills } from './prompt'
import { SkillToolKind } from './tools'

/** Files listed in <skill_resources> when a skill is loaded. */
const RESOURCE_LIST_CAP = 200
/** Default page size of read_skill_file. */
const READ_MAX_LINES = 400
const READ_MAX_BYTES = 40 * 1024
const SEARCH_MAX_MATCHES = 100
const SEARCH_LINE_LENGTH = 400

export interface SkillExecutionContext {
  skills: Skill[]
  getFiles: (skillId: string) => Promise<SkillFileRecord[]>
  /** Skills already loaded in this conversation; a second load returns a short note. */
  activated: Set<string>
}

export interface SkillToolResult {
  text: string
  isError?: boolean
}

const SKILL_ENTRY_FILE = 'SKILL.md'

function asString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asPositiveInt(value: unknown): number | undefined {
  const numeric = typeof value === 'number' ? value : typeof value === 'string' ? parseInt(value, 10) : NaN
  if (!isFinite(numeric) || numeric < 1) return undefined
  return Math.floor(numeric)
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  if (bytes >= 1024) return Math.round(bytes / 1024) + ' KB'
  return bytes + ' B'
}

function escapeXmlAttribute(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function resolveSkill(ctx: SkillExecutionContext, name: string): Skill | null {
  const enabled = getEnabledSkills(ctx.skills)
  const exact = enabled.filter((skill) => skill.name === name)[0]
  if (exact) return exact
  const lower = name.toLowerCase()
  return enabled.filter((skill) => skill.name.toLowerCase() === lower)[0] || null
}

function unknownSkillError(ctx: SkillExecutionContext, name: string): SkillToolResult {
  const names = getEnabledSkills(ctx.skills).map((skill) => skill.name)
  if (names.length === 0) {
    return { text: 'No skills are currently enabled.', isError: true }
  }
  return {
    text: 'Unknown skill "' + name + '". Available skills: ' + names.join(', ') + '.',
    isError: true
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Translate a glob (`*`, `**`, `?`) into an anchored regular expression. */
function globToRegExp(glob: string): RegExp {
  let pattern = ''
  for (let i = 0; i < glob.length; i++) {
    const char = glob.charAt(i)
    if (char === '*') {
      if (glob.charAt(i + 1) === '*') {
        pattern += '.*'
        i++
        // Swallow the separator right after a "**" so "references/**" also matches "references"
        if (glob.charAt(i + 1) === '/') i++
      } else {
        pattern += '[^/]*'
      }
    } else if (char === '?') {
      pattern += '[^/]'
    } else {
      pattern += escapeRegExp(char)
    }
  }
  return new RegExp('^' + pattern + '$', 'i')
}

/**
 * A query is treated as a regular expression only when it both contains regex metacharacters
 * and compiles; otherwise it is a literal, case-insensitive substring search.
 */
function buildSearchMatcher(query: string): RegExp {
  if (/[\\^$.|?*+()[\]{}]/.test(query)) {
    try {
      return new RegExp(query, 'i')
    } catch {
      // Not a valid pattern: fall through to a literal search
    }
  }
  return new RegExp(escapeRegExp(query), 'i')
}

function findFile(files: SkillFileRecord[], path: string): SkillFileRecord | null {
  return files.filter((file) => file.path === path)[0] || null
}

/** Suggest paths a mistyped argument probably meant: same basename, or same directory. */
function suggestPaths(files: SkillFileRecord[], path: string): string[] {
  const slash = path.lastIndexOf('/')
  const base = slash === -1 ? path : path.substring(slash + 1)
  const dir = slash === -1 ? '' : path.substring(0, slash)

  const sameBase: string[] = []
  const sameDir: string[] = []
  files.forEach((file) => {
    const fileSlash = file.path.lastIndexOf('/')
    const fileBase = fileSlash === -1 ? file.path : file.path.substring(fileSlash + 1)
    const fileDir = fileSlash === -1 ? '' : file.path.substring(0, fileSlash)
    if (fileBase.toLowerCase() === base.toLowerCase()) sameBase.push(file.path)
    else if (fileDir === dir) sameDir.push(file.path)
  })

  return sameBase.concat(sameDir).slice(0, 10)
}

/**
 * Render a skill for injection into the conversation: the body, where its files live, and the
 * list of bundled resources (which are never read eagerly). Shared by `load_skill` and by
 * explicit `/skill-name` invocation so both produce the same block.
 */
export function buildSkillContentBlock(skill: Skill, resourcePaths: string[]): string {
  const resources = (resourcePaths || [])
    .filter((path) => path !== SKILL_ENTRY_FILE)
    .slice()
    .sort()

  const shown = resources.slice(0, RESOURCE_LIST_CAP)
  const lines: string[] = []
  lines.push('<skill_content name="' + escapeXmlAttribute(skill.name) + '">')
  lines.push(skill.body)
  lines.push('')
  lines.push('Skill directory: skills/' + skill.name)
  lines.push('Relative paths in this skill are relative to the skill directory.')

  if (shown.length > 0) {
    lines.push('<skill_resources>')
    shown.forEach((path) => lines.push('  ' + path))
    if (resources.length > shown.length) {
      lines.push('  ... ' + (resources.length - shown.length) + ' more file(s) not listed')
    }
    lines.push('</skill_resources>')
  }

  lines.push('</skill_content>')
  return lines.join('\n')
}

async function loadSkill(ctx: SkillExecutionContext, args: Record<string, unknown>): Promise<SkillToolResult> {
  const name = asString(args.name).trim()
  const skill = resolveSkill(ctx, name)
  if (!skill) return unknownSkillError(ctx, name)

  if (ctx.activated.has(skill.id)) {
    return {
      text: 'Skill "' + skill.name + '" is already loaded in this conversation; follow the instructions above.'
    }
  }
  ctx.activated.add(skill.id)

  const resources = (skill.files || []).map((file) => file.path)
  return { text: buildSkillContentBlock(skill, resources) }
}

async function readSkillFile(ctx: SkillExecutionContext, args: Record<string, unknown>): Promise<SkillToolResult> {
  const skill = resolveSkill(ctx, asString(args.skill).trim())
  if (!skill) return unknownSkillError(ctx, asString(args.skill))

  const rawPath = asString(args.path).trim()
  const path = normalizeSkillPath(rawPath)
  if (!path) {
    return { text: 'Invalid path "' + rawPath + '": paths must stay inside the skill directory.', isError: true }
  }

  const files = await ctx.getFiles(skill.id)
  const file = findFile(files, path)
  if (!file) {
    const suggestions = suggestPaths(files, path)
    return {
      text:
        'File "' + path + '" is not part of skill "' + skill.name + '".' +
        (suggestions.length > 0 ? ' Did you mean: ' + suggestions.join(', ') + '?' : ' Use list_skill_files to see what it ships.'),
      isError: true
    }
  }

  if (!file.isText) {
    return {
      text:
        path + ' is a binary file (' + file.mimeType + ', ' + formatBytes(file.size) + ') and cannot be read as text. ' +
        'Only its metadata is available in this environment.'
    }
  }

  const content = file.text || ''
  const allLines = content.split('\n')
  const total = allLines.length

  const requestedStart = asPositiveInt(args.start_line)
  const requestedEnd = asPositiveInt(args.end_line)
  const start = Math.min(requestedStart || 1, total)
  let end = requestedEnd ? Math.min(requestedEnd, total) : total
  if (end < start) end = start

  // Cap the page so a long reference never floods the conversation
  let truncatedByCap = false
  if (end - start + 1 > READ_MAX_LINES) {
    end = start + READ_MAX_LINES - 1
    truncatedByCap = true
  }

  const numbered: string[] = []
  let bytes = 0
  let lastLine = start - 1
  for (let i = start; i <= end; i++) {
    const line = allLines[i - 1]
    bytes += line.length + 1
    if (bytes > READ_MAX_BYTES && numbered.length > 0) {
      truncatedByCap = true
      break
    }
    numbered.push(i + '\t' + line)
    lastLine = i
  }

  const header = path + ' (' + file.mimeType + ', ' + formatBytes(file.size) + ', ' + total + ' lines)'
  const footer =
    lastLine < total
      ? '\n\n[showing lines ' + start + '-' + lastLine + ' of ' + total +
        '; call again with start_line=' + (lastLine + 1) + ' to continue]'
      : truncatedByCap || start > 1
        ? '\n\n[showing lines ' + start + '-' + lastLine + ' of ' + total + ']'
        : ''

  return { text: header + '\n' + numbered.join('\n') + footer }
}

async function listSkillFiles(ctx: SkillExecutionContext, args: Record<string, unknown>): Promise<SkillToolResult> {
  const skill = resolveSkill(ctx, asString(args.skill).trim())
  if (!skill) return unknownSkillError(ctx, asString(args.skill))

  const dir = normalizeSkillPath(asString(args.dir).trim())
  const prefix = dir ? dir + '/' : ''
  const files = await ctx.getFiles(skill.id)
  const scoped = files.filter((file) => !prefix || file.path.indexOf(prefix) === 0)

  if (scoped.length === 0) {
    return {
      text: dir
        ? 'No files under "' + dir + '" in skill "' + skill.name + '".'
        : 'Skill "' + skill.name + '" has no files.',
      isError: !!dir
    }
  }

  // Directories first, then files, both alphabetically
  const directories: string[] = []
  scoped.forEach((file) => {
    const segments = file.path.split('/')
    let current = ''
    for (let i = 0; i < segments.length - 1; i++) {
      current = current ? current + '/' + segments[i] : segments[i]
      if (directories.indexOf(current) === -1) directories.push(current)
    }
  })
  directories.sort()

  const lines: string[] = []
  lines.push('skills/' + skill.name + (dir ? '/' + dir : '') + ':')
  directories.forEach((directory) => {
    if (prefix && directory.indexOf(prefix) !== 0) return
    lines.push('  ' + directory + '/')
  })
  scoped
    .slice()
    .sort((a, b) => a.path.localeCompare(b.path))
    .forEach((file) => {
      lines.push('  ' + file.path + '  (' + formatBytes(file.size) + (file.isText ? '' : ', [binary]') + ')')
    })

  return { text: lines.join('\n') }
}

async function searchSkillFiles(ctx: SkillExecutionContext, args: Record<string, unknown>): Promise<SkillToolResult> {
  const skill = resolveSkill(ctx, asString(args.skill).trim())
  if (!skill) return unknownSkillError(ctx, asString(args.skill))

  const query = asString(args.query)
  if (!query.trim()) {
    return { text: 'A non-empty query is required.', isError: true }
  }

  const globArgument = asString(args.glob).trim()
  const globMatcher = globArgument ? globToRegExp(globArgument) : null
  const matcher = buildSearchMatcher(query)

  const files = await ctx.getFiles(skill.id)
  const candidates = files
    .filter((file) => file.isText)
    .filter((file) => !globMatcher || globMatcher.test(file.path))
    .sort((a, b) => a.path.localeCompare(b.path))

  const results: string[] = []
  let truncated = false
  for (let f = 0; f < candidates.length && !truncated; f++) {
    const file = candidates[f]
    const lines = (file.text || '').split('\n')
    for (let i = 0; i < lines.length; i++) {
      if (!matcher.test(lines[i])) continue
      const text = lines[i].length > SEARCH_LINE_LENGTH ? lines[i].substring(0, SEARCH_LINE_LENGTH) + '...' : lines[i]
      results.push(file.path + ':' + (i + 1) + ': ' + text.trim())
      if (results.length >= SEARCH_MAX_MATCHES) {
        truncated = true
        break
      }
    }
  }

  if (results.length === 0) {
    return {
      text:
        'No match for "' + query + '" in skill "' + skill.name + '"' +
        (globArgument ? ' (files matching ' + globArgument + ')' : '') + '.'
    }
  }

  const header = results.length + ' match(es) for "' + query + '" in skill "' + skill.name + '":'
  const footer = truncated ? '\n\n[stopped at ' + SEARCH_MAX_MATCHES + ' matches; narrow the query or use glob]' : ''
  return { text: header + '\n' + results.join('\n') + footer }
}

/** Run one built-in skill tool. Never throws: failures come back as `isError` results. */
export async function executeSkillTool(
  kind: SkillToolKind,
  args: Record<string, unknown>,
  ctx: SkillExecutionContext
): Promise<SkillToolResult> {
  const safeArgs = args || {}
  try {
    if (kind === 'load_skill') return await loadSkill(ctx, safeArgs)
    if (kind === 'read_skill_file') return await readSkillFile(ctx, safeArgs)
    if (kind === 'list_skill_files') return await listSkillFiles(ctx, safeArgs)
    if (kind === 'search_skill_files') return await searchSkillFiles(ctx, safeArgs)
    return { text: 'Unknown skill tool "' + kind + '".', isError: true }
  } catch (error) {
    return { text: error instanceof Error ? error.message : String(error), isError: true }
  }
}
