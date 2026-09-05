'use client'

import React, { useState, useEffect, useMemo, useRef, forwardRef, useImperativeHandle } from 'react'
import { Skill, SkillFileInfo, SkillFileRecord } from '@/types'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Modal, ModalBody, ModalFooter } from '@/components/ui/modal'
import { Tooltip } from '@/components/ui/tooltip'
import { MessageContent } from '@/components/markdown'
import { useToast } from '@/components/ui/toast'
import {
  SKILL_ENTRY_FILE,
  SKILL_TEMPLATE,
  createSkillFromMarkdown,
  exportSkillToZip,
  importSkillFromFolderInput,
  importSkillFromZip,
  importSampleSkill,
  normalizeSkillPath,
  slugifyHeading,
  uniqueHeadingSlug,
  isSkillImportSuccess,
  parseSkillMarkdown,
  validateSkill,
  SkillImportResult,
  SkillImportSuccess
} from '@/lib/skills'
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Download,
  Edit2,
  FileText,
  FileCode,
  FolderOpen,
  Loader2,
  Plus,
  Save,
  Trash2,
  AlertTriangle,
  ArrowLeft,
  FileArchive,
  X
} from 'lucide-react'

interface SkillsPanelProps {
  skills: Skill[]
  onSkillCreate: (skill: Skill, files: SkillFileRecord[]) => Promise<void>
  onSkillUpdate: (skill: Skill) => Promise<void>
  onSkillDelete: (skillId: string) => Promise<void>
  getSkillFiles: (skillId: string) => Promise<SkillFileRecord[]>
  onSkillFileSave: (skillId: string, path: string, text: string) => Promise<void>
}

export interface SkillsPanelRef {
  openCreateModal: () => void
}

type ImportTab = 'folder' | 'zip' | 'paste'

interface FileTreeNode {
  name: string
  path: string
  isDir: boolean
  file?: SkillFileInfo
  children: FileTreeNode[]
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  if (bytes >= 1024) return Math.round(bytes / 1024) + ' KB'
  return bytes + ' B'
}

function isMarkdownPath(path: string): boolean {
  return /\.(md|markdown)$/i.test(path)
}

/** Links the browser should handle itself; the markdown renderer already opens them in a new tab. */
function isExternalHref(href: string): boolean {
  return /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(href)
}

/**
 * Resolve a link written inside a skill file against the directory of that file, the way a
 * reader of the skill directory would: "../scripts/extract.py" from "references/REFERENCE.md"
 * becomes "scripts/extract.py". Returns '' when the link escapes the skill directory.
 */
function resolveSkillHref(fromPath: string, href: string): string {
  const withoutFragment = href.split('#')[0].split('?')[0]
  if (!withoutFragment) return ''

  const slash = fromPath.lastIndexOf('/')
  const directory = slash === -1 ? '' : fromPath.substring(0, slash)
  const combined =
    withoutFragment.charAt(0) === '/'
      ? withoutFragment
      : directory
        ? directory + '/' + withoutFragment
        : withoutFragment

  // Collapse "." and ".." before normalizing, which rejects any ".." it still sees
  const segments = combined.split('/')
  const stack: string[] = []
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    if (!segment || segment === '.') continue
    if (segment === '..') {
      if (stack.length === 0) return '' // escapes the skill directory
      stack.pop()
      continue
    }
    stack.push(segment)
  }

  return normalizeSkillPath(stack.join('/'))
}

/** Turn the flat path index into a directory tree for rendering. */
function buildFileTree(files: SkillFileInfo[]): FileTreeNode[] {
  const root: FileTreeNode = { name: '', path: '', isDir: true, children: [] }

  files.forEach((file) => {
    const segments = file.path.split('/')
    let current = root
    for (let i = 0; i < segments.length; i++) {
      const isLast = i === segments.length - 1
      const name = segments[i]
      const path = current.path ? current.path + '/' + name : name
      let next: FileTreeNode | undefined
      for (let c = 0; c < current.children.length; c++) {
        if (current.children[c].name === name && current.children[c].isDir === !isLast) {
          next = current.children[c]
          break
        }
      }
      if (!next) {
        next = { name, path, isDir: !isLast, file: isLast ? file : undefined, children: [] }
        current.children.push(next)
      }
      current = next
    }
  })

  const sortNodes = (nodes: FileTreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    nodes.forEach((node) => sortNodes(node.children))
  }
  sortNodes(root.children)

  return root.children
}

export const SkillsPanel = forwardRef<SkillsPanelRef, SkillsPanelProps>(
  ({ skills, onSkillCreate, onSkillUpdate, onSkillDelete, getSkillFiles, onSkillFileSave }, ref) => {
    const { showToast, ToastContainer } = useToast()
    const [showImport, setShowImport] = useState(false)
    const [importTab, setImportTab] = useState<ImportTab>('folder')
    const [importBusy, setImportBusy] = useState(false)
    const [importResults, setImportResults] = useState<SkillImportResult[] | null>(null)
    const [pasteText, setPasteText] = useState(SKILL_TEMPLATE)
    const [pendingReplace, setPendingReplace] = useState<{ existing: Skill; incoming: SkillImportSuccess } | null>(null)

    const [expanded, setExpanded] = useState<Set<string>>(new Set())
    const [collapsedDirs, setCollapsedDirs] = useState<Set<string>>(new Set())
    const [skillToDelete, setSkillToDelete] = useState<Skill | null>(null)
    const [viewer, setViewer] = useState<{ skill: Skill; file: SkillFileInfo; text: string } | null>(null)
    const [viewerLoading, setViewerLoading] = useState(false)
    const [viewerEditing, setViewerEditing] = useState(false)
    const [viewerDraft, setViewerDraft] = useState('')
    const [viewerSaving, setViewerSaving] = useState(false)
    // Markdown files open rendered; the toggle keeps the raw text one click away
    const [viewerRendered, setViewerRendered] = useState(true)
    // Paths visited in the current modal, so relative links can be walked back
    const [viewerHistory, setViewerHistory] = useState<string[]>([])
    // The rendered markdown box: heading ids are assigned here and it is the scroll parent
    const renderedRef = useRef<HTMLDivElement>(null)
    // Fragment to jump to once the next file has been rendered
    const pendingFragmentRef = useRef<string | null>(null)
    const [downloading, setDownloading] = useState<string | null>(null)

    const folderInputRef = useRef<HTMLInputElement>(null)
    const zipInputRef = useRef<HTMLInputElement>(null)

    useImperativeHandle(ref, () => ({
      openCreateModal: () => {
        setImportResults(null)
        setPasteText(SKILL_TEMPLATE)
        setImportTab('folder')
        setShowImport(true)
      }
    }))

    // React's typings do not know the directory picker attributes, so set them on the element
    useEffect(() => {
      const input = folderInputRef.current
      if (!input) return
      input.setAttribute('webkitdirectory', '')
      input.setAttribute('directory', '')
    }, [showImport, importTab])

    const toggleExpanded = (skillId: string) => {
      setExpanded((prev) => {
        const next = new Set(prev)
        if (next.has(skillId)) next.delete(skillId)
        else next.add(skillId)
        return next
      })
    }

    const toggleDir = (key: string) => {
      setCollapsedDirs((prev) => {
        const next = new Set(prev)
        if (next.has(key)) next.delete(key)
        else next.add(key)
        return next
      })
    }

    const handleToggleEnabled = async (skill: Skill) => {
      try {
        await onSkillUpdate({ ...skill, enabled: !skill.enabled, updatedAt: Date.now() })
      } catch {
        showToast('Failed to update the skill.', 'error')
      }
    }

    /** Save every imported skill, asking before replacing one that has the same name. */
    const persistResults = async (results: SkillImportResult[]) => {
      const successes: SkillImportSuccess[] = []
      results.forEach((result) => {
        if (isSkillImportSuccess(result)) successes.push(result)
      })

      for (let i = 0; i < successes.length; i++) {
        const incoming = successes[i]
        const existing = skills.filter((skill) => skill.name === incoming.skill.name)[0]
        if (existing) {
          setPendingReplace({ existing, incoming })
          continue
        }
        try {
          await onSkillCreate(incoming.skill, incoming.files)
        } catch {
          showToast('Failed to save skill "' + incoming.skill.name + '".', 'error')
        }
      }
    }

    const runImport = async (run: () => Promise<SkillImportResult[]>) => {
      setImportBusy(true)
      setImportResults(null)
      try {
        const results = await run()
        setImportResults(results)
        await persistResults(results)
      } catch (error) {
        setImportResults([{ folder: '', error: error instanceof Error ? error.message : String(error) }])
      } finally {
        setImportBusy(false)
      }
    }

    const handleFolderPicked = (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files
      if (!files || files.length === 0) return
      void runImport(() => importSkillFromFolderInput(files))
      event.target.value = ''
    }

    const handleZipPicked = (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files && event.target.files[0]
      if (!file) return
      void runImport(() => importSkillFromZip(file))
      event.target.value = ''
    }

    const handlePasteImport = () => {
      void runImport(async () => [await createSkillFromMarkdown(pasteText)])
    }

    const confirmReplace = async () => {
      if (!pendingReplace) return
      const { existing, incoming } = pendingReplace
      setPendingReplace(null)
      try {
        await onSkillDelete(existing.id)
        await onSkillCreate(incoming.skill, incoming.files)
        showToast('Replaced skill "' + incoming.skill.name + '".', 'success')
      } catch {
        showToast('Failed to replace skill "' + incoming.skill.name + '".', 'error')
      }
    }

    const loadFileIntoViewer = async (skill: Skill, file: SkillFileInfo) => {
      setViewerLoading(true)
      setViewerEditing(false)
      setViewerRendered(true)
      setViewer({ skill, file, text: '' })
      try {
        const records = await getSkillFiles(skill.id)
        const record = records.filter((entry) => entry.path === file.path)[0]
        const text = record && typeof record.text === 'string' ? record.text : ''
        setViewer({ skill, file, text })
        setViewerDraft(text)
      } catch {
        showToast('Failed to read the file.', 'error')
        setViewer(null)
      } finally {
        setViewerLoading(false)
      }
    }

    /** Opening from the file tree starts a fresh navigation stack. */
    const openFile = async (skill: Skill, file: SkillFileInfo) => {
      if (!file.isText) return
      setViewerHistory([file.path])
      await loadFileIntoViewer(skill, file)
    }

    /** Follow a relative link inside the skill without leaving the modal. */
    const navigateToSkillPath = (path: string) => {
      if (!viewer) return

      const target = (viewer.skill.files || []).filter((entry) => entry.path === path)[0]
      if (!target) {
        showToast('"' + path + '" is not part of this skill.', 'error')
        return
      }
      if (!target.isText) {
        showToast('"' + path + '" is a binary file and cannot be previewed.', 'error')
        return
      }
      if (target.path === viewer.file.path) return

      setViewerHistory((prev) => prev.concat([target.path]))
      void loadFileIntoViewer(viewer.skill, target)
    }

    const goBackInViewer = () => {
      if (!viewer || viewerHistory.length < 2) return

      const previousPath = viewerHistory[viewerHistory.length - 2]
      const target = (viewer.skill.files || []).filter((entry) => entry.path === previousPath)[0]
      if (!target) return

      setViewerHistory((prev) => prev.slice(0, prev.length - 1))
      void loadFileIntoViewer(viewer.skill, target)
    }

    /**
     * One delegated handler for the rendered markdown: relative links navigate inside the modal,
     * fragment links are swallowed (the renderer emits no heading ids), and external links keep
     * the renderer's own target="_blank" behaviour.
     */
    const handleRenderedClick = (event: React.MouseEvent<HTMLDivElement>) => {
      const node = event.target as HTMLElement | null
      const anchor = node && node.closest ? node.closest('a') : null
      if (!anchor) return

      const href = anchor.getAttribute('href') || ''
      if (!href || isExternalHref(href)) return

      event.preventDefault()

      const hashIndex = href.indexOf('#')
      const fragment = hashIndex === -1 ? '' : href.substring(hashIndex + 1)

      // Same-document link: scroll inside the rendered box, no navigation, no history entry
      if (href.charAt(0) === '#') {
        scrollToFragment(fragment)
        return
      }

      if (!viewer) return
      const resolved = resolveSkillHref(viewer.file.path, href)
      if (!resolved) {
        showToast('"' + href + '" points outside the skill directory.', 'error')
        return
      }
      // Consumed by the effect above once the target file has rendered
      pendingFragmentRef.current = fragment || null
      navigateToSkillPath(resolved)
    }

    /**
     * Find the heading a fragment points at. Ids assigned by the effect below are tried first,
     * but the slugs are also recomputed from the live headings: React re-renders the markdown
     * subtree after the effect has run, which drops imperatively assigned ids, so matching by
     * text is what actually makes the jump reliable.
     */
    const findFragmentTarget = (container: HTMLElement, fragment: string): Element | null => {
      let decoded = fragment
      try {
        decoded = decodeURIComponent(fragment)
      } catch {
        // Keep the raw fragment when it is not valid percent-encoding
      }

      const candidates = [decoded, fragment]
      for (let i = 0; i < candidates.length; i++) {
        const candidate = candidates[i]
        if (!candidate) continue
        try {
          const selector = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(candidate) : candidate
          const byId = container.querySelector('#' + selector)
          if (byId) return byId
        } catch {
          // Invalid selector: fall through to the slug scan
        }
      }

      const wanted = slugifyHeading(decoded) || decoded
      const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6')
      const used: Record<string, number> = {}
      for (let i = 0; i < headings.length; i++) {
        const heading = headings[i] as HTMLElement
        if (uniqueHeadingSlug(heading.textContent || '', used) === wanted) return heading
      }

      return null
    }

    /**
     * Jump to a heading inside the rendered box; returns false when the fragment matches nothing.
     *
     * The offset is computed against the box and written to scrollTop rather than going through
     * scrollIntoView: the box is nested inside another scrollable element, and smooth behaviour
     * turned out to be a no-op in the browser, leaving the view where it was.
     */
    const scrollToFragment = (fragment: string): boolean => {
      const container = renderedRef.current
      if (!container || !fragment) return false

      const target = findFragmentTarget(container, fragment)
      if (!target) return false

      const containerTop = container.getBoundingClientRect().top
      const targetTop = target.getBoundingClientRect().top
      container.scrollTop = container.scrollTop + (targetTop - containerTop)
      return true
    }

    /** Show where a relative link would go, lazily, on hover. */
    const handleRenderedMouseOver = (event: React.MouseEvent<HTMLDivElement>) => {
      const node = event.target as HTMLElement | null
      const anchor = node && node.closest ? node.closest('a') : null
      if (!anchor || anchor.title) return

      const href = anchor.getAttribute('href') || ''
      if (!href || isExternalHref(href) || href.charAt(0) === '#' || !viewer) return

      const resolved = resolveSkillHref(viewer.file.path, href)
      anchor.title = resolved ? 'Open ' + resolved : 'Outside the skill directory'
    }

    /**
     * Save an edited file. Editing SKILL.md re-runs parsing and validation so the catalog entry
     * (name, description, warnings) stays in sync with what the model would be told.
     */
    const saveViewerDraft = async () => {
      if (!viewer) return
      setViewerSaving(true)
      try {
        await onSkillFileSave(viewer.skill.id, viewer.file.path, viewerDraft)

        if (viewer.file.path === SKILL_ENTRY_FILE) {
          const parsed = parseSkillMarkdown(viewerDraft)
          const validated = validateSkill(parsed.frontmatter, viewer.skill.name)
          if (validated.fatal) {
            showToast(validated.fatal, 'error')
          } else {
            await onSkillUpdate({
              ...viewer.skill,
              name: validated.name || viewer.skill.name,
              description: validated.description,
              license: validated.license,
              compatibility: validated.compatibility,
              metadata: validated.metadata,
              allowedTools: validated.allowedTools,
              body: parsed.body,
              frontmatterRaw: parsed.frontmatterRaw,
              warnings: parsed.errors.concat(validated.warnings),
              updatedAt: Date.now()
            })
          }
        }

        setViewer({ ...viewer, text: viewerDraft })
        setViewerEditing(false)
        showToast('Saved.', 'success')
      } catch {
        showToast('Failed to save the file.', 'error')
      } finally {
        setViewerSaving(false)
      }
    }

    const viewerIsMarkdown = !!viewer && isMarkdownPath(viewer.file.path)

    /**
     * Markdown shown in the viewer keeps the whole file, but the YAML frontmatter is wrapped in a
     * fenced block: the renderer would otherwise swallow it (or draw it as a horizontal rule).
     */
    const viewerMarkdown = useMemo(() => {
      if (!viewer || !viewerIsMarkdown) return ''
      const parsed = parseSkillMarkdown(viewer.text)
      if (!parsed.frontmatterRaw) return viewer.text
      return '```yaml\n' + parsed.frontmatterRaw + '\n```\n\n' + parsed.body
    }, [viewer, viewerIsMarkdown])

    /**
     * The shared markdown renderer emits no heading ids, so they are assigned here after every
     * render of a file. A fragment left over from a cross-file link is consumed in the same pass,
     * once the new content is actually in the DOM.
     */
    useEffect(() => {
      const container = renderedRef.current
      if (!container || !viewerIsMarkdown || !viewerRendered || viewerLoading) return

      const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6')
      const used: Record<string, number> = {}
      for (let i = 0; i < headings.length; i++) {
        const heading = headings[i] as HTMLElement
        const slug = uniqueHeadingSlug(heading.textContent || '', used)
        if (slug && !heading.id) heading.id = slug
      }

      const pending = pendingFragmentRef.current
      if (pending && scrollToFragment(pending)) {
        pendingFragmentRef.current = null
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [viewerMarkdown, viewerIsMarkdown, viewerRendered, viewerLoading])

    const downloadZip = async (skill: Skill) => {
      setDownloading(skill.id)
      try {
        const files = await getSkillFiles(skill.id)
        const blob = await exportSkillToZip(skill, files)
        const url = URL.createObjectURL(blob)
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = skill.name + '.zip'
        document.body.appendChild(anchor)
        anchor.click()
        document.body.removeChild(anchor)
        // Give the browser a moment to start the download before dropping the blob
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      } catch {
        showToast('Failed to build the zip file.', 'error')
      } finally {
        setDownloading(null)
      }
    }

    const renderTree = (skill: Skill, nodes: FileTreeNode[], depth: number): React.ReactNode => {
      return nodes.map((node) => {
        const key = skill.id + ':' + node.path
        if (node.isDir) {
          const collapsed = collapsedDirs.has(key)
          return (
            <div key={key}>
              <button
                type="button"
                onClick={() => toggleDir(key)}
                className="w-full flex items-center gap-1 py-0.5 text-xs text-muted-foreground hover:text-foreground"
                style={{ paddingLeft: depth * 12 }}
              >
                {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                <FolderOpen className="w-3 h-3" />
                <span className="truncate">{node.name}</span>
              </button>
              {!collapsed && renderTree(skill, node.children, depth + 1)}
            </div>
          )
        }

        const file = node.file as SkillFileInfo
        return (
          <button
            key={key}
            type="button"
            disabled={!file.isText}
            onClick={() => openFile(skill, file)}
            className={`w-full flex items-center gap-1 py-0.5 text-xs ${file.isText ? 'text-foreground hover:bg-muted/60' : 'text-muted-foreground cursor-default'}`}
            style={{ paddingLeft: depth * 12 + 16 }}
            title={file.isText ? 'Open ' + file.path : file.path + ' (binary, listed only)'}
          >
            <FileText className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{node.name}</span>
            <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground flex-shrink-0">
              {!file.isText && <span className="px-1 rounded bg-muted">binary</span>}
              {formatBytes(file.size)}
            </span>
          </button>
        )
      })
    }

    const importSummary = () => {
      if (!importResults) return null
      const succeeded = importResults.filter(isSkillImportSuccess)
      const failed = importResults.filter((result) => !isSkillImportSuccess(result))

      return (
        <div className="space-y-2 text-xs max-h-[40vh] overflow-y-auto">
          {succeeded.map((result) => (
            <div key={result.skill.id} className="border border-border rounded p-2">
              <div className="font-medium">Imported "{result.skill.name}"</div>
              <div className="text-muted-foreground">{result.files.length} file{result.files.length === 1 ? '' : 's'}</div>
              {result.warnings.length > 0 && (
                <ul className="mt-1 list-disc pl-4 text-amber-600 dark:text-amber-400">
                  {result.warnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          {failed.map((result, index) => (
            <div key={index} className="border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 rounded p-2 text-red-600">
              {(result as { folder: string }).folder ? '"' + (result as { folder: string }).folder + '": ' : ''}
              {(result as { error: string }).error}
            </div>
          ))}
        </div>
      )
    }

    return (
      <div className="space-y-3">
        {skills.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No skills yet</p>
            <p className="text-xs mt-1">Import a folder or a zip containing a SKILL.md, or paste one.</p>
            <div className="flex items-center justify-center gap-2 mt-3">
              <Button size="sm" onClick={() => { setImportResults(null); setImportTab('folder'); setShowImport(true) }}>
                <Plus className="w-3 h-3 mr-1" /> Add Skill
              </Button>
              <Button size="sm" variant="outline" onClick={() => { setShowImport(true); void runImport(() => importSampleSkill()) }} disabled={importBusy}>
                {importBusy ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Download className="w-3 h-3 mr-1" />}
                Import sample skill
              </Button>
            </div>
          </div>
        )}

        {skills.map((skill) => {
          const isExpanded = expanded.has(skill.id)
          const tree = buildFileTree(skill.files || [])
          return (
            <div key={skill.id} className={`border border-border rounded-lg ${skill.enabled ? '' : 'opacity-70'}`}>
              <div className="p-3 flex items-start gap-2">
                <button
                  type="button"
                  onClick={() => toggleExpanded(skill.id)}
                  className="mt-0.5 text-muted-foreground hover:text-foreground"
                  title={isExpanded ? 'Collapse' : 'Expand'}
                >
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                <div className="min-w-0 flex-1 cursor-pointer" onClick={() => toggleExpanded(skill.id)}>
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm font-medium truncate">{skill.name}</span>
                    <span className="text-[10px] px-1 rounded bg-muted text-muted-foreground">{skill.source}</span>
                    {skill.warnings && skill.warnings.length > 0 && (
                      <Tooltip content={skill.warnings.join('\n')}>
                        <span className="inline-flex items-center gap-0.5 text-[10px] px-1 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400">
                          <AlertTriangle className="w-3 h-3" />
                          {skill.warnings.length}
                        </span>
                      </Tooltip>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground line-clamp-2">{skill.description}</div>
                  <div className="text-xs text-muted-foreground">
                    {(skill.files || []).length} file{(skill.files || []).length === 1 ? '' : 's'}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Tooltip content={skill.enabled ? 'Enabled: offered to the model' : 'Disabled: hidden from the model'}>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={skill.enabled}
                      onClick={() => handleToggleEnabled(skill)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${skill.enabled ? 'bg-green-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${skill.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                  </Tooltip>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-border p-3 space-y-3">
                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => downloadZip(skill)} disabled={downloading === skill.id}>
                      {downloading === skill.id ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Download className="w-3 h-3 mr-1" />}
                      Download zip
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-red-600" onClick={() => setSkillToDelete(skill)}>
                      <Trash2 className="w-3 h-3 mr-1" /> Delete
                    </Button>
                  </div>

                  {(skill.license || skill.compatibility || skill.metadata || skill.allowedTools) && (
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      {skill.license && <div>License: <span className="text-foreground">{skill.license}</span></div>}
                      {skill.compatibility && <div>Compatibility: <span className="text-foreground">{skill.compatibility}</span></div>}
                      {skill.allowedTools && <div>Allowed tools: <span className="text-foreground">{skill.allowedTools}</span> (informational)</div>}
                      {skill.metadata &&
                        Object.keys(skill.metadata).map((key) => (
                          <div key={key}>
                            {key}: <span className="text-foreground">{(skill.metadata as Record<string, string>)[key]}</span>
                          </div>
                        ))}
                    </div>
                  )}

                  {skill.warnings && skill.warnings.length > 0 && (
                    <ul className="text-[11px] text-amber-600 dark:text-amber-400 list-disc pl-4 space-y-0.5">
                      {skill.warnings.map((warning, index) => (
                        <li key={index}>{warning}</li>
                      ))}
                    </ul>
                  )}

                  <div className="border border-border rounded p-2 max-h-64 overflow-y-auto">
                    {tree.length === 0 ? (
                      <div className="text-xs text-muted-foreground">No files.</div>
                    ) : (
                      renderTree(skill, tree, 0)
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {/* Import modal */}
        {showImport && (
          <Modal isOpen={true} onClose={() => setShowImport(false)} title="Add Skill" size="xl">
            <ModalBody className="space-y-3">
              <div className="flex gap-1 border-b border-border">
                {(['folder', 'zip', 'paste'] as ImportTab[]).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setImportTab(tab)}
                    className={`px-3 py-1.5 text-xs border-b-2 -mb-px transition-colors ${importTab === tab ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                  >
                    {tab === 'folder' ? 'Folder' : tab === 'zip' ? 'Zip' : 'Paste SKILL.md'}
                  </button>
                ))}
              </div>

              {importTab === 'folder' && (
                <div className="space-y-2 min-h-[160px]">
                  <p className="text-xs text-muted-foreground">
                    Pick the skill directory (the one containing SKILL.md). A folder holding several skill
                    directories imports all of them at once.
                  </p>
                  <input ref={folderInputRef} type="file" multiple className="hidden" onChange={handleFolderPicked} />
                  <Button size="sm" variant="outline" onClick={() => folderInputRef.current?.click()} disabled={importBusy}>
                    <FolderOpen className="w-3 h-3 mr-1" /> Choose folder
                  </Button>
                </div>
              )}

              {importTab === 'zip' && (
                <div className="space-y-2 min-h-[160px]">
                  <p className="text-xs text-muted-foreground">
                    Upload a .zip containing a SKILL.md, either at the root or inside one directory.
                  </p>
                  <input ref={zipInputRef} type="file" accept=".zip" className="hidden" onChange={handleZipPicked} />
                  <Button size="sm" variant="outline" onClick={() => zipInputRef.current?.click()} disabled={importBusy}>
                    <FileArchive className="w-3 h-3 mr-1" /> Choose zip
                  </Button>
                </div>
              )}

              {importTab === 'paste' && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Paste a SKILL.md for a single-file skill. Resources can be added later by importing a folder.
                  </p>
                  <Textarea
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    rows={24}
                    className="font-mono text-xs min-h-[50vh] resize-y"
                    spellCheck={false}
                  />
                  <Button size="sm" onClick={handlePasteImport} disabled={importBusy || !pasteText.trim()}>
                    {importBusy ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Plus className="w-3 h-3 mr-1" />}
                    Create skill
                  </Button>
                </div>
              )}

              {importBusy && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" /> Reading files...
                </div>
              )}

              {importSummary()}
            </ModalBody>
            <ModalFooter>
              <Button variant="outline" onClick={() => setShowImport(false)}>Close</Button>
            </ModalFooter>
          </Modal>
        )}

        {/* Replace confirmation */}
        {pendingReplace && (
          <Modal isOpen={true} onClose={() => setPendingReplace(null)} title="Skill already exists" size="sm">
            <ModalBody>
              <p className="text-sm">
                A skill named <span className="font-medium">{pendingReplace.incoming.skill.name}</span> is already
                installed. Replace it with the imported one?
              </p>
              <p className="text-xs text-muted-foreground mt-2">The existing skill and all of its files are deleted.</p>
            </ModalBody>
            <ModalFooter>
              <Button variant="outline" onClick={() => setPendingReplace(null)}>Cancel</Button>
              <Button variant="destructive" onClick={confirmReplace}>Replace</Button>
            </ModalFooter>
          </Modal>
        )}

        {/* Delete confirmation */}
        {skillToDelete && (
          <Modal isOpen={true} onClose={() => setSkillToDelete(null)} title="Delete Skill" size="sm">
            <ModalBody>
              <p className="text-sm">
                Delete <span className="font-medium">{skillToDelete.name || 'this skill'}</span> and all of its files?
              </p>
            </ModalBody>
            <ModalFooter>
              <Button variant="outline" onClick={() => setSkillToDelete(null)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  const target = skillToDelete
                  setSkillToDelete(null)
                  try {
                    await onSkillDelete(target.id)
                  } catch {
                    showToast('Failed to delete the skill.', 'error')
                  }
                }}
              >
                Delete
              </Button>
            </ModalFooter>
          </Modal>
        )}

        {/* File viewer / editor */}
        {viewer && (
          <Modal
            isOpen={true}
            onClose={() => { setViewer(null); setViewerEditing(false) }}
            title={viewer.skill.name + ' / ' + viewer.file.path}
            size="xl"
          >
            {/* Both modes use the same 60vh box so toggling Edit never resizes the modal */}
            <ModalBody>
              {viewerLoading ? (
                <div className="h-[60vh] flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading...
                </div>
              ) : viewerEditing ? (
                <Textarea
                  value={viewerDraft}
                  onChange={(e) => setViewerDraft(e.target.value)}
                  rows={30}
                  className="font-mono text-xs min-h-[60vh] max-h-[60vh] resize-y"
                  spellCheck={false}
                />
              ) : viewerIsMarkdown && viewerRendered ? (
                <div
                  ref={renderedRef}
                  className="min-h-[60vh] max-h-[60vh] overflow-y-auto"
                  onClick={handleRenderedClick}
                  onMouseOver={handleRenderedMouseOver}
                >
                  <MessageContent content={viewerMarkdown} className="min-w-0" showToggle={false} />
                </div>
              ) : (
                <pre className="text-xs whitespace-pre-wrap break-all min-h-[60vh] max-h-[60vh] overflow-y-auto">{viewer.text}</pre>
              )}
            </ModalBody>
            <ModalFooter>
              {viewerEditing ? (
                <>
                  <Button variant="outline" onClick={() => { setViewerDraft(viewer.text); setViewerEditing(false) }} disabled={viewerSaving}>
                    <X className="w-3 h-3 mr-1" /> Cancel
                  </Button>
                  <Button onClick={saveViewerDraft} disabled={viewerSaving}>
                    {viewerSaving ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Save className="w-3 h-3 mr-1" />}
                    Save
                  </Button>
                </>
              ) : (
                <>
                  {/* Navigation and view mode stay on the left, away from Close / Edit */}
                  <div className="mr-auto flex items-center gap-2">
                    {viewerHistory.length > 1 && (
                      <Button variant="outline" onClick={goBackInViewer} disabled={viewerLoading} title="Back to the previous file">
                        <ArrowLeft className="w-3 h-3 mr-1" /> Back
                      </Button>
                    )}
                    {viewerIsMarkdown && !viewerLoading && (
                      <Button
                        variant="outline"
                        onClick={() => setViewerRendered(!viewerRendered)}
                        title={viewerRendered ? 'Show the raw file' : 'Render the markdown'}
                      >
                        {viewerRendered ? <FileCode className="w-3 h-3 mr-1" /> : <FileText className="w-3 h-3 mr-1" />}
                        {viewerRendered ? 'Raw' : 'Rendered'}
                      </Button>
                    )}
                  </div>
                  <Button variant="outline" onClick={() => { setViewer(null); setViewerEditing(false) }}>Close</Button>
                  <Button onClick={() => { setViewerDraft(viewer.text); setViewerEditing(true) }} disabled={viewerLoading}>
                    <Edit2 className="w-3 h-3 mr-1" /> Edit
                  </Button>
                </>
              )}
            </ModalFooter>
          </Modal>
        )}

        <ToastContainer />
      </div>
    )
  }
)

SkillsPanel.displayName = 'SkillsPanel'
