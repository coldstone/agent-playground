/**
 * Skill import pipeline: turn a picked folder, a zip or a pasted SKILL.md into the records the
 * IndexedDB stores expect. Browser-only (File, Blob, TextDecoder), no Node APIs.
 */
import { unzipSync, zipSync } from 'fflate'
import { Skill, SkillFileInfo, SkillFileRecord, SkillSource } from '@/types'
import { generateId } from '@/lib/utils'
import { parseSkillMarkdown } from './parse'
import { validateSkill } from './validate'
import { SKILL_LIMITS, guessMimeType, isTextFile, normalizeSkillPath, shouldSkipPath } from './files'

export const SKILL_ENTRY_FILE = 'SKILL.md'

export interface SkillImportInput {
  path: string
  file: File | Blob
  size: number
}

export interface SkillImportSuccess {
  skill: Skill
  files: SkillFileRecord[]
  warnings: string[]
}

export interface SkillImportFailure {
  error: string
  folder: string
}

export type SkillImportResult = SkillImportSuccess | SkillImportFailure

export function isSkillImportSuccess(result: SkillImportResult): result is SkillImportSuccess {
  return (result as SkillImportSuccess).skill !== undefined
}

export interface SkillImportOptions {
  source: SkillSource
  /** Name used as the skill folder when the entry file sits at the root (zip, paste). */
  rootHint?: string
}

/** Minimal SKILL.md offered in the "Paste" tab. */
export const SKILL_TEMPLATE = [
  '---',
  'name: my-skill',
  'description: What this skill does, and when the model should use it.',
  '---',
  '',
  '# My skill',
  '',
  'Write the instructions the model should follow here.',
  ''
].join('\n')

function directoryOf(path: string): string {
  const slash = path.lastIndexOf('/')
  return slash === -1 ? '' : path.substring(0, slash)
}

function baseNameOf(path: string): string {
  const slash = path.lastIndexOf('/')
  return slash === -1 ? path : path.substring(slash + 1)
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  if (bytes >= 1024) return Math.round(bytes / 1024) + ' KB'
  return bytes + ' B'
}

/**
 * Every directory that directly contains a SKILL.md is a skill root. Roots nested inside
 * another root are dropped: a reference folder that happens to carry its own SKILL.md belongs
 * to the outer skill, it is not a second skill.
 */
function findSkillRoots(paths: string[]): string[] {
  const roots: string[] = []
  paths.forEach((path) => {
    if (baseNameOf(path) === SKILL_ENTRY_FILE) {
      const root = directoryOf(path)
      if (roots.indexOf(root) === -1) roots.push(root)
    }
  })

  roots.sort((a, b) => a.length - b.length)

  const kept: string[] = []
  roots.forEach((root) => {
    for (let i = 0; i < kept.length; i++) {
      if (root.indexOf(kept[i] + '/') === 0) return // nested inside a shallower root
    }
    kept.push(root)
  })

  return kept
}

async function readBytes(file: File | Blob): Promise<Uint8Array> {
  const buffer = await file.arrayBuffer()
  return new Uint8Array(buffer)
}

function decodeText(bytes: Uint8Array): string {
  if (typeof TextDecoder === 'undefined') return ''
  return new TextDecoder('utf-8').decode(bytes)
}

/**
 * Build the file records of one skill. Oversize files are skipped with a warning; exceeding the
 * file count or the total size budget aborts the skill (returned as `error`).
 */
async function collectSkillFiles(
  skillId: string,
  entries: Array<{ relativePath: string; input: SkillImportInput }>
): Promise<{ files: SkillFileRecord[]; warnings: string[]; error?: string }> {
  const warnings: string[] = []
  const files: SkillFileRecord[] = []
  let totalBytes = 0

  if (entries.length > SKILL_LIMITS.maxFiles) {
    return {
      files: [],
      warnings,
      error: 'The skill contains ' + entries.length + ' files, more than the limit of ' + SKILL_LIMITS.maxFiles
    }
  }

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    const path = entry.relativePath
    const declaredSize = entry.input.size

    // Cheap rejection before reading: an obviously oversize file never reaches memory
    const extensionSaysText = isTextFile(path)
    if (extensionSaysText && declaredSize > SKILL_LIMITS.maxTextFileBytes) {
      warnings.push('Skipped "' + path + '": ' + formatBytes(declaredSize) + ' exceeds the text file limit of ' + formatBytes(SKILL_LIMITS.maxTextFileBytes))
      continue
    }
    if (declaredSize > SKILL_LIMITS.maxBinaryFileBytes) {
      warnings.push('Skipped "' + path + '": ' + formatBytes(declaredSize) + ' exceeds the file limit of ' + formatBytes(SKILL_LIMITS.maxBinaryFileBytes))
      continue
    }

    let bytes: Uint8Array
    try {
      bytes = await readBytes(entry.input.file)
    } catch (error) {
      warnings.push('Skipped "' + path + '": could not be read (' + (error instanceof Error ? error.message : String(error)) + ')')
      continue
    }

    const size = bytes.byteLength
    const isText = isTextFile(path, bytes)

    if (isText && size > SKILL_LIMITS.maxTextFileBytes) {
      warnings.push('Skipped "' + path + '": ' + formatBytes(size) + ' exceeds the text file limit of ' + formatBytes(SKILL_LIMITS.maxTextFileBytes))
      continue
    }

    totalBytes += size
    if (totalBytes > SKILL_LIMITS.maxSkillBytes) {
      return {
        files: [],
        warnings,
        error: 'The skill is larger than the limit of ' + formatBytes(SKILL_LIMITS.maxSkillBytes)
      }
    }

    const guessed = guessMimeType(path)
    // A file sniffed as text but with an unknown extension is still text to the reader
    const mimeType = isText && guessed === 'application/octet-stream' ? 'text/plain' : guessed

    const record: SkillFileRecord = {
      id: skillId + ':' + path,
      skillId,
      path,
      size,
      mimeType,
      isText
    }
    if (isText) {
      record.text = decodeText(bytes)
    } else {
      record.blob = new Blob([bytes], { type: mimeType })
    }
    files.push(record)
  }

  files.sort((a, b) => a.path.localeCompare(b.path))
  return { files, warnings }
}

export function toSkillFileIndex(files: SkillFileRecord[]): SkillFileInfo[] {
  return files.map((file) => ({
    path: file.path,
    size: file.size,
    mimeType: file.mimeType,
    isText: file.isText
  }))
}

/**
 * Import one or more skills from a flat list of files.
 *
 * `path` is the full path as picked (`webkitRelativePath` or the zip entry name); stored paths
 * are relative to the skill directory, so the entry file always ends up at "SKILL.md".
 */
export async function importSkillFromFiles(
  files: SkillImportInput[],
  options: SkillImportOptions
): Promise<SkillImportResult[]> {
  const normalized: SkillImportInput[] = []
  files.forEach((entry) => {
    const path = normalizeSkillPath(entry.path)
    if (!path || shouldSkipPath(path)) return
    normalized.push({ path, file: entry.file, size: entry.size })
  })

  const roots = findSkillRoots(normalized.map((entry) => entry.path))
  if (roots.length === 0) {
    return [{ folder: options.rootHint || '', error: 'No SKILL.md found in the selection' }]
  }

  const results: SkillImportResult[] = []

  for (let r = 0; r < roots.length; r++) {
    const root = roots[r]
    const prefix = root ? root + '/' : ''
    const folderName = root ? baseNameOf(root) : options.rootHint || ''

    const entries: Array<{ relativePath: string; input: SkillImportInput }> = []
    normalized.forEach((entry) => {
      if (prefix && entry.path.indexOf(prefix) !== 0) return
      const relativePath = entry.path.substring(prefix.length)
      if (!relativePath) return
      // A nested skill belongs to its own root, not to this one
      for (let i = 0; i < roots.length; i++) {
        if (roots[i] !== root && roots[i].indexOf(prefix) === 0) {
          const nestedPrefix = roots[i].substring(prefix.length) + '/'
          if (relativePath.indexOf(nestedPrefix) === 0) return
        }
      }
      entries.push({ relativePath: relativePath, input: entry })
    })

    const entryFile = entries.filter((entry) => entry.relativePath === SKILL_ENTRY_FILE)[0]
    if (!entryFile) {
      results.push({ folder: folderName || root, error: 'No SKILL.md found in "' + (root || '/') + '"' })
      continue
    }

    const skillId = generateId()
    const collected = await collectSkillFiles(skillId, entries)
    if (collected.error) {
      results.push({ folder: folderName || root, error: collected.error })
      continue
    }

    const entryRecord = collected.files.filter((file) => file.path === SKILL_ENTRY_FILE)[0]
    if (!entryRecord || typeof entryRecord.text !== 'string') {
      results.push({ folder: folderName || root, error: 'SKILL.md could not be read as text' })
      continue
    }

    const parsed = parseSkillMarkdown(entryRecord.text)
    const validated = validateSkill(parsed.frontmatter, folderName || undefined)
    if (validated.fatal) {
      results.push({ folder: folderName || root, error: validated.fatal })
      continue
    }

    const now = Date.now()
    const warnings = parsed.errors.concat(validated.warnings).concat(collected.warnings)
    const skill: Skill = {
      id: skillId,
      name: validated.name || folderName || 'skill',
      description: validated.description,
      license: validated.license,
      compatibility: validated.compatibility,
      metadata: validated.metadata,
      allowedTools: validated.allowedTools,
      body: parsed.body,
      frontmatterRaw: parsed.frontmatterRaw,
      files: toSkillFileIndex(collected.files),
      enabled: true,
      source: options.source,
      warnings,
      createdAt: now,
      updatedAt: now
    }

    results.push({ skill, files: collected.files, warnings })
  }

  return results
}

/** Where the bundled sample skill lives, relative to the app root. */
export const SAMPLE_SKILL_PATH = '/sample-skills/pdf-processing'

interface SampleSkillManifest {
  name: string
  files: string[]
}

/**
 * Import the sample skill shipped in `public/sample-skills`. The file list comes from a small
 * manifest because a static export has no directory listing.
 */
export async function importSampleSkill(basePath: string = SAMPLE_SKILL_PATH): Promise<SkillImportResult[]> {
  let manifest: SampleSkillManifest
  try {
    const response = await fetch(basePath + '/manifest.json')
    if (!response.ok) throw new Error('HTTP ' + response.status)
    manifest = await response.json()
  } catch (error) {
    return [{ folder: 'sample', error: 'Could not read the sample skill manifest: ' + (error instanceof Error ? error.message : String(error)) }]
  }

  const folder = manifest.name || 'sample-skill'
  const inputs: SkillImportInput[] = []

  for (let i = 0; i < (manifest.files || []).length; i++) {
    const relativePath = manifest.files[i]
    try {
      const response = await fetch(basePath + '/' + relativePath)
      if (!response.ok) throw new Error('HTTP ' + response.status)
      const blob = await response.blob()
      inputs.push({ path: folder + '/' + relativePath, file: blob, size: blob.size })
    } catch (error) {
      return [{ folder, error: 'Could not read "' + relativePath + '": ' + (error instanceof Error ? error.message : String(error)) }]
    }
  }

  return importSkillFromFiles(inputs, { source: 'url', rootHint: folder })
}

/** Import from `<input type="file" webkitdirectory>`. */
export function importSkillFromFolderInput(fileList: FileList): Promise<SkillImportResult[]> {
  const inputs: SkillImportInput[] = []
  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i]
    const relative = (file as File & { webkitRelativePath?: string }).webkitRelativePath
    inputs.push({ path: relative || file.name, file, size: file.size })
  }
  return importSkillFromFiles(inputs, { source: 'folder' })
}

/** Import from a `.zip` archive; the skill directory may be at the root or nested. */
export async function importSkillFromZip(file: File): Promise<SkillImportResult[]> {
  const bytes = await readBytes(file)

  let unzipped: Record<string, Uint8Array>
  try {
    unzipped = unzipSync(bytes)
  } catch (error) {
    return [{ folder: file.name, error: 'Could not read the zip file: ' + (error instanceof Error ? error.message : String(error)) }]
  }

  const inputs: SkillImportInput[] = []
  Object.keys(unzipped).forEach((name) => {
    if (!name || name.charAt(name.length - 1) === '/') return // directory entry
    if (name.indexOf('__MACOSX/') === 0) return
    const content = unzipped[name]
    inputs.push({ path: name, file: new Blob([content]), size: content.byteLength })
  })

  const rootHint = file.name.replace(/\.zip$/i, '')
  return importSkillFromFiles(inputs, { source: 'zip', rootHint })
}

/** Create a single-file skill from a pasted SKILL.md. */
export async function createSkillFromMarkdown(markdown: string): Promise<SkillImportResult> {
  const parsed = parseSkillMarkdown(markdown)
  const validated = validateSkill(parsed.frontmatter)
  if (validated.fatal) {
    return { folder: '', error: validated.fatal }
  }

  const skillId = generateId()
  const name = validated.name || 'skill'
  const text = markdown.replace(/\r\n/g, '\n')
  const size = typeof TextEncoder === 'undefined' ? text.length : new TextEncoder().encode(text).byteLength

  const record: SkillFileRecord = {
    id: skillId + ':' + SKILL_ENTRY_FILE,
    skillId,
    path: SKILL_ENTRY_FILE,
    size,
    mimeType: 'text/markdown',
    isText: true,
    text
  }

  const now = Date.now()
  const warnings = parsed.errors.concat(validated.warnings)
  const skill: Skill = {
    id: skillId,
    name,
    description: validated.description,
    license: validated.license,
    compatibility: validated.compatibility,
    metadata: validated.metadata,
    allowedTools: validated.allowedTools,
    body: parsed.body,
    frontmatterRaw: parsed.frontmatterRaw,
    files: toSkillFileIndex([record]),
    enabled: true,
    source: 'manual',
    warnings,
    createdAt: now,
    updatedAt: now
  }

  return { skill, files: [record], warnings }
}

/** Pack a skill and its files into a zip whose top-level directory is the skill name. */
export async function exportSkillToZip(skill: Skill, files: SkillFileRecord[]): Promise<Blob> {
  const encoder = typeof TextEncoder === 'undefined' ? null : new TextEncoder()
  const entries: Record<string, Uint8Array> = {}

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const name = skill.name + '/' + file.path
    if (file.isText) {
      const text = file.text || ''
      entries[name] = encoder ? encoder.encode(text) : new Uint8Array(0)
    } else if (file.blob) {
      entries[name] = await readBytes(file.blob)
    } else {
      entries[name] = new Uint8Array(0)
    }
  }

  const zipped = zipSync(entries)
  return new Blob([zipped], { type: 'application/zip' })
}
