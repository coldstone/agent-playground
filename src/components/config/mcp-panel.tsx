'use client'

import React, { useState, forwardRef, useImperativeHandle, useMemo } from 'react'
import { MCPServer, MCPHeader, MCPToolInfo, MCPResourceInfo, MCPPromptInfo } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Modal, ModalBody, ModalFooter } from '@/components/ui/modal'
import { Tooltip } from '@/components/ui/tooltip'
import { useToast } from '@/components/ui/toast'
import { generateId } from '@/lib/utils'
import { parseMCPServerInput, readMCPResource, getMCPPrompt, isToolEnabled, normalizeMCPServer, MCPServerDraft } from '@/lib/mcp'
import {
  ChevronDown,
  ChevronUp,
  Edit2,
  Trash2,
  RefreshCw,
  Loader2,
  CheckCircle,
  XCircle,
  Circle,
  Plug,
  Wrench,
  FileText,
  MessageSquare,
  Eye,
  ShieldAlert,
  Lock,
  Plus,
  X
} from 'lucide-react'

interface MCPPanelProps {
  servers: MCPServer[]
  onServerCreate: (server: MCPServer) => Promise<void>
  onServerUpdate: (server: MCPServer) => Promise<void>
  onServerDelete: (serverId: string) => Promise<void>
  onServerConnect: (serverId: string, refresh?: boolean) => Promise<void>
}

export interface MCPPanelRef {
  openCreateModal: () => void
}

type DetailTab = 'tools' | 'resources' | 'prompts'

export const MCPPanel = forwardRef<MCPPanelRef, MCPPanelProps>(
  ({ servers, onServerCreate, onServerUpdate, onServerDelete, onServerConnect }, ref) => {
    const { showToast, ToastContainer } = useToast()
    const [showEditor, setShowEditor] = useState(false)
    const [editingServer, setEditingServer] = useState<MCPServer | null>(null)
    const [expanded, setExpanded] = useState<Set<string>>(new Set())
    const [activeTabs, setActiveTabs] = useState<Record<string, DetailTab>>({})
    const [toolFilters, setToolFilters] = useState<Record<string, string>>({})
    const [serverToDelete, setServerToDelete] = useState<MCPServer | null>(null)
    const [preview, setPreview] = useState<{ title: string; content: string } | null>(null)
    const [previewLoading, setPreviewLoading] = useState(false)
    const [promptArgsRequest, setPromptArgsRequest] = useState<{ server: MCPServer; prompt: MCPPromptInfo } | null>(null)
    const [promptArgValues, setPromptArgValues] = useState<Record<string, string>>({})
    const [promptArgErrors, setPromptArgErrors] = useState<Record<string, boolean>>({})

    useImperativeHandle(ref, () => ({
      openCreateModal: () => {
        setEditingServer(null)
        setShowEditor(true)
      }
    }))

    const toggleExpanded = (id: string) => {
      setExpanded((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
    }

    const handleSaveDrafts = async (drafts: MCPServerDraft[]) => {
      const now = Date.now()
      if (editingServer) {
        const draft = drafts[0]
        const updated: MCPServer = {
          ...editingServer,
          name: draft.name,
          url: draft.url,
          headers: draft.headers,
          status: 'idle',
          error: undefined,
          updatedAt: now
        }
        await onServerUpdate(updated)
        setShowEditor(false)
        setEditingServer(null)
        void onServerConnect(updated.id, true)
        return
      }

      const created: MCPServer[] = drafts.map((draft) => ({
        id: generateId(),
        name: draft.name,
        url: draft.url,
        headers: draft.headers,
        enabled: true,
        disabledTools: [],
        tools: [],
        resources: [],
        resourceTemplates: [],
        prompts: [],
        status: 'idle',
        createdAt: now,
        updatedAt: now
      }))
      for (const server of created) {
        await onServerCreate(server)
      }
      setShowEditor(false)
      setExpanded((prev) => new Set([...Array.from(prev), ...created.map((s) => s.id)]))
      for (const server of created) {
        void onServerConnect(server.id)
      }
    }

    const handleToggleEnabled = async (server: MCPServer) => {
      await onServerUpdate({ ...server, enabled: !server.enabled, updatedAt: Date.now() })
    }

    const handleToggleTool = async (server: MCPServer, toolName: string) => {
      const disabled = new Set(server.disabledTools)
      if (disabled.has(toolName)) disabled.delete(toolName)
      else disabled.add(toolName)
      await onServerUpdate({ ...server, disabledTools: Array.from(disabled), updatedAt: Date.now() })
    }

    const handleSetAllTools = async (server: MCPServer, enabledAll: boolean, subset?: MCPToolInfo[]) => {
      const names = (subset || server.tools).map((t) => t.name)
      const disabled = new Set(server.disabledTools)
      names.forEach((n) => (enabledAll ? disabled.delete(n) : disabled.add(n)))
      await onServerUpdate({ ...server, disabledTools: Array.from(disabled), updatedAt: Date.now() })
    }

    const handleReadResource = async (server: MCPServer, resource: MCPResourceInfo) => {
      setPreviewLoading(true)
      setPreview({ title: resource.title || resource.name || resource.uri, content: 'Loading...' })
      try {
        const result = await readMCPResource(server, resource.uri)
        const text = (result.contents || [])
          .map((c) => {
            if (!c) return ''
            if (typeof c.text === 'string') return c.text
            if (typeof c.blob === 'string') return `[binary ${c.mimeType || ''} ${Math.floor((c.blob.length * 3) / 4)} bytes]`
            return JSON.stringify(c, null, 2)
          })
          .join('\n\n')
        setPreview({ title: resource.title || resource.name || resource.uri, content: text || '(empty)' })
      } catch (error) {
        setPreview({ title: resource.uri, content: `Failed to read resource: ${error instanceof Error ? error.message : String(error)}` })
      } finally {
        setPreviewLoading(false)
      }
    }

    // Fetch a prompt and show its rendered messages in the preview modal
    const runGetPrompt = async (server: MCPServer, prompt: MCPPromptInfo, args: Record<string, string>) => {
      setPreviewLoading(true)
      setPreview({ title: prompt.title || prompt.name, content: 'Loading...' })
      try {
        const result = await getMCPPrompt(server, prompt.name, args)
        const text = [
          result.description ? `# ${result.description}\n` : '',
          ...(result.messages || []).map((m) => {
            const c = m.content
            const body = c?.type === 'text' ? c.text : JSON.stringify(c, null, 2)
            return `[${m.role}]\n${body}`
          })
        ]
          .filter(Boolean)
          .join('\n\n')
        setPreview({ title: prompt.title || prompt.name, content: text || '(empty)' })
      } catch (error) {
        setPreview({ title: prompt.name, content: `Failed to get prompt: ${error instanceof Error ? error.message : String(error)}` })
      } finally {
        setPreviewLoading(false)
      }
    }

    // Prompts with arguments ask for them in a modal form; argument-less prompts are fetched right away
    const handleGetPrompt = (server: MCPServer, prompt: MCPPromptInfo) => {
      if (prompt.arguments && prompt.arguments.length > 0) {
        setPromptArgValues(Object.fromEntries(prompt.arguments.map((arg) => [arg.name, ''])))
        setPromptArgErrors({})
        setPromptArgsRequest({ server, prompt })
        return
      }
      void runGetPrompt(server, prompt, {})
    }

    const handleSubmitPromptArgs = () => {
      if (!promptArgsRequest) return
      const { server, prompt } = promptArgsRequest
      const errors: Record<string, boolean> = {}
      const args: Record<string, string> = {}
      for (const arg of prompt.arguments || []) {
        const value = (promptArgValues[arg.name] || '').trim()
        if (arg.required && !value) {
          errors[arg.name] = true
          continue
        }
        if (value) args[arg.name] = value
      }
      if (Object.keys(errors).length > 0) {
        setPromptArgErrors(errors)
        return
      }
      setPromptArgsRequest(null)
      void runGetPrompt(server, prompt, args)
    }

    const statusIcon = (server: MCPServer) => {
      switch (server.status) {
        case 'connecting':
          return <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
        case 'connected':
          return <CheckCircle className="w-3.5 h-3.5 text-green-600" />
        case 'error':
          return <XCircle className="w-3.5 h-3.5 text-red-600" />
        default:
          return <Circle className="w-3.5 h-3.5 text-gray-400" />
      }
    }

    const renderTools = (server: MCPServer) => {
      const filter = (toolFilters[server.id] || '').toLowerCase()
      const visible = server.tools.filter(
        (t) => !filter || t.name.toLowerCase().includes(filter) || (t.description || '').toLowerCase().includes(filter)
      )
      const enabledCount = server.tools.filter((t) => isToolEnabled(server, t.name)).length
      const allVisibleEnabled = visible.length > 0 && visible.every((t) => isToolEnabled(server, t.name))

      return (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Input
              value={toolFilters[server.id] || ''}
              onChange={(e) => setToolFilters((prev) => ({ ...prev, [server.id]: e.target.value }))}
              placeholder="Filter tools..."
              className="h-7 text-xs"
            />
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs whitespace-nowrap"
              onClick={() => handleSetAllTools(server, !allVisibleEnabled, visible)}
              disabled={visible.length === 0}
            >
              {allVisibleEnabled ? 'Disable all' : 'Enable all'}
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">
            {enabledCount} / {server.tools.length} tools enabled{filter ? ` (${visible.length} shown)` : ''}
          </div>
          <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
            {visible.length === 0 && (
              <div className="text-xs text-muted-foreground py-2">
                {server.tools.length === 0 ? 'No tools reported. Connect to load the tool list.' : 'No tools match the filter.'}
              </div>
            )}
            {visible.map((tool) => (
              <label
                key={tool.name}
                className="flex items-start gap-2 p-1.5 rounded hover:bg-muted/60 cursor-pointer"
                title={tool.description || tool.name}
              >
                <input
                  type="checkbox"
                  className="apg-checkbox mt-0.5"
                  checked={isToolEnabled(server, tool.name)}
                  onChange={() => handleToggleTool(server, tool.name)}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 flex-wrap">
                    <span className="text-xs font-medium break-all">{tool.title || tool.name}</span>
                    {tool.title && tool.title !== tool.name && (
                      <span className="text-[10px] text-muted-foreground break-all">{tool.name}</span>
                    )}
                    {tool.annotations?.readOnlyHint && (
                      <Tooltip content="Read-only tool">
                        <span className="inline-flex items-center gap-0.5 text-[10px] px-1 rounded bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300">
                          <Lock className="w-2.5 h-2.5" /> read-only
                        </span>
                      </Tooltip>
                    )}
                    {tool.annotations?.destructiveHint && !tool.annotations?.readOnlyHint && (
                      <Tooltip content="May perform destructive updates">
                        <span className="inline-flex items-center gap-0.5 text-[10px] px-1 rounded bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                          <ShieldAlert className="w-2.5 h-2.5" /> destructive
                        </span>
                      </Tooltip>
                    )}
                  </div>
                  {tool.description && (
                    <div className="text-[11px] text-muted-foreground line-clamp-2 break-words">{tool.description}</div>
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>
      )
    }

    const renderResources = (server: MCPServer) => (
      <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
        {server.resources.length === 0 && server.resourceTemplates.length === 0 && (
          <div className="text-xs text-muted-foreground py-2">No resources reported.</div>
        )}
        {server.resources.map((resource) => (
          <div key={resource.uri} className="flex items-start gap-2 p-1.5 rounded hover:bg-muted/60">
            <FileText className="w-3.5 h-3.5 mt-0.5 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium break-all">{resource.title || resource.name}</div>
              <div className="text-[11px] text-muted-foreground break-all">
                {resource.uri}
                {resource.mimeType ? ` · ${resource.mimeType}` : ''}
              </div>
              {resource.description && <div className="text-[11px] text-muted-foreground line-clamp-2">{resource.description}</div>}
            </div>
            <Button variant="ghost" size="sm" className="h-6 px-1.5" title="Read resource" onClick={() => handleReadResource(server, resource)}>
              <Eye className="w-3.5 h-3.5" />
            </Button>
          </div>
        ))}
        {server.resourceTemplates.map((template) => (
          <div key={template.uriTemplate} className="flex items-start gap-2 p-1.5 rounded">
            <FileText className="w-3.5 h-3.5 mt-0.5 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium break-all">{template.title || template.name} <span className="text-[10px] text-muted-foreground">(template)</span></div>
              <div className="text-[11px] text-muted-foreground break-all">{template.uriTemplate}</div>
            </div>
          </div>
        ))}
      </div>
    )

    const renderPrompts = (server: MCPServer) => (
      <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
        {server.prompts.length === 0 && <div className="text-xs text-muted-foreground py-2">No prompts reported.</div>}
        {server.prompts.map((prompt) => (
          <div key={prompt.name} className="flex items-start gap-2 p-1.5 rounded hover:bg-muted/60">
            <MessageSquare className="w-3.5 h-3.5 mt-0.5 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-medium break-all">{prompt.title || prompt.name}</div>
              {prompt.description && <div className="text-[11px] text-muted-foreground line-clamp-2">{prompt.description}</div>}
              {prompt.arguments && prompt.arguments.length > 0 && (
                <div className="text-[11px] text-muted-foreground break-all">
                  args: {prompt.arguments.map((a) => `${a.name}${a.required ? '*' : ''}`).join(', ')}
                </div>
              )}
            </div>
            <Button variant="ghost" size="sm" className="h-6 px-1.5" title="Preview prompt" onClick={() => handleGetPrompt(server, prompt)}>
              <Eye className="w-3.5 h-3.5" />
            </Button>
          </div>
        ))}
      </div>
    )

    return (
      <div className="space-y-3">
        {servers.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Plug className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No MCP servers yet</p>
            <p className="text-xs mt-1">Add a Streamable HTTP server by URL or paste an mcpServers JSON config.</p>
            <Button size="sm" className="mt-3" onClick={() => { setEditingServer(null); setShowEditor(true) }}>
              <Plus className="w-3 h-3 mr-1" /> Add MCP Server
            </Button>
          </div>
        )}

        {servers.map((rawServer) => {
          // Records persisted by older versions may miss array fields; heal them before rendering
          const server = normalizeMCPServer(rawServer)
          const isExpanded = expanded.has(server.id)
          const tab = activeTabs[server.id] || 'tools'
          const enabledCount = server.tools.filter((t) => isToolEnabled(server, t.name)).length
          return (
            <div key={server.id} className={`border border-border rounded-lg ${server.enabled ? '' : 'opacity-70'}`}>
              <div className="p-3 flex items-start gap-2">
                <button
                  type="button"
                  onClick={() => toggleExpanded(server.id)}
                  className="mt-0.5 text-muted-foreground hover:text-foreground"
                  title={isExpanded ? 'Collapse' : 'Expand'}
                >
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                <div className="min-w-0 flex-1 cursor-pointer" onClick={() => toggleExpanded(server.id)}>
                  <div className="flex items-center gap-2">
                    {statusIcon(server)}
                    <span className="text-sm font-medium truncate">{server.name}</span>
                  </div>
                  <div className="text-xs text-muted-foreground truncate" title={server.url}>{server.url}</div>
                  {/* Protocol version sits with the status line: in the title row it crowded the name */}
                  <div className="flex items-center gap-1.5 flex-wrap text-xs text-muted-foreground">
                    <span>
                      {server.status === 'connected'
                        ? `${enabledCount} / ${server.tools.length} tools enabled`
                        : server.status === 'connecting'
                          ? 'Connecting...'
                          : server.status === 'error'
                            ? 'Connection failed'
                            : 'Not connected'}
                    </span>
                    {server.protocolVersion && (
                      <Tooltip content={`Protocol ${server.protocolVersion} (${server.protocolEra || 'unknown'} era)`}>
                        <span className="text-[10px] px-1 rounded bg-muted text-muted-foreground whitespace-nowrap">{server.protocolVersion}</span>
                      </Tooltip>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Tooltip content={server.enabled ? 'Enabled: tools are offered to the model' : 'Disabled: tools are hidden from the model'}>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={server.enabled}
                      onClick={() => handleToggleEnabled(server)}
                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${server.enabled ? 'bg-green-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${server.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                  </Tooltip>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-border p-3 space-y-3">
                  {server.error && (
                    <div className="text-xs text-red-600 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded p-2 break-all">
                      {server.error}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1">
                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => onServerConnect(server.id, true)} disabled={server.status === 'connecting'}>
                      <RefreshCw className={`w-3 h-3 mr-1 ${server.status === 'connecting' ? 'animate-spin' : ''}`} />
                      {server.status === 'connected' ? 'Refresh' : 'Connect'}
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => { setEditingServer(server); setShowEditor(true) }}>
                      <Edit2 className="w-3 h-3 mr-1" /> Edit
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-red-600" onClick={() => setServerToDelete(server)}>
                      <Trash2 className="w-3 h-3 mr-1" /> Delete
                    </Button>
                  </div>

                  {server.serverInfo && (
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <div>
                        Server: <span className="text-foreground">{server.serverInfo.title || server.serverInfo.name}</span> v{server.serverInfo.version}
                        {server.protocolVersion && <> · protocol {server.protocolVersion} ({server.protocolEra})</>}
                      </div>
                      {server.capabilities && (
                        <div>Capabilities: {Object.keys(server.capabilities).join(', ') || 'none'}</div>
                      )}
                      {server.instructions && (
                        <details>
                          <summary className="cursor-pointer">Instructions</summary>
                          <pre className="whitespace-pre-wrap text-[11px] mt-1 max-h-40 overflow-y-auto">{server.instructions}</pre>
                        </details>
                      )}
                    </div>
                  )}

                  <div className="flex gap-1 border-b border-border">
                    {(['tools', 'resources', 'prompts'] as DetailTab[]).map((t) => {
                      const count = t === 'tools' ? server.tools.length : t === 'resources' ? server.resources.length + server.resourceTemplates.length : server.prompts.length
                      const Icon = t === 'tools' ? Wrench : t === 'resources' ? FileText : MessageSquare
                      return (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setActiveTabs((prev) => ({ ...prev, [server.id]: t }))}
                          className={`flex items-center gap-1 px-2 py-1 text-xs border-b-2 -mb-px ${tab === t ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                        >
                          <Icon className="w-3 h-3" />
                          {t.charAt(0).toUpperCase() + t.slice(1)} ({count})
                        </button>
                      )
                    })}
                  </div>

                  {tab === 'tools' && renderTools(server)}
                  {tab === 'resources' && renderResources(server)}
                  {tab === 'prompts' && renderPrompts(server)}
                </div>
              )}
            </div>
          )
        })}

        {showEditor && (
          <MCPServerEditor
            server={editingServer}
            onSave={async (drafts) => {
              try {
                await handleSaveDrafts(drafts)
              } catch (error) {
                showToast(error instanceof Error ? error.message : 'Failed to save MCP server', 'error')
              }
            }}
            onCancel={() => { setShowEditor(false); setEditingServer(null) }}
          />
        )}

        {serverToDelete && (
          <Modal isOpen={true} onClose={() => setServerToDelete(null)} title="Delete MCP Server" size="sm">
            <ModalBody>
              <p className="text-sm">
                Delete <span className="font-medium">{serverToDelete.name}</span>? Its tools will no longer be available in conversations.
              </p>
            </ModalBody>
            <ModalFooter>
              <Button variant="outline" onClick={() => setServerToDelete(null)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  const target = serverToDelete
                  setServerToDelete(null)
                  try {
                    await onServerDelete(target.id)
                  } catch (error) {
                    showToast('Failed to delete MCP server', 'error')
                  }
                }}
              >
                Delete
              </Button>
            </ModalFooter>
          </Modal>
        )}

        {promptArgsRequest && (
          <Modal
            isOpen={true}
            onClose={() => setPromptArgsRequest(null)}
            title={promptArgsRequest.prompt.title || promptArgsRequest.prompt.name}
            size="md"
          >
            <ModalBody className="space-y-3">
              {promptArgsRequest.prompt.description && (
                <p className="text-xs text-muted-foreground">{promptArgsRequest.prompt.description}</p>
              )}
              {(promptArgsRequest.prompt.arguments || []).map((arg) => (
                <div key={arg.name} className="space-y-1">
                  <Label htmlFor={`mcp-prompt-arg-${arg.name}`} className="text-xs">
                    {arg.name}
                    {arg.required && <span className="text-red-500 ml-0.5">*</span>}
                  </Label>
                  <Input
                    id={`mcp-prompt-arg-${arg.name}`}
                    value={promptArgValues[arg.name] || ''}
                    onChange={(e) => {
                      const value = e.target.value
                      setPromptArgValues((prev) => ({ ...prev, [arg.name]: value }))
                      if (promptArgErrors[arg.name]) {
                        setPromptArgErrors((prev) => {
                          const next = { ...prev }
                          delete next[arg.name]
                          return next
                        })
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        handleSubmitPromptArgs()
                      }
                    }}
                    placeholder={arg.required ? 'Required' : 'Optional'}
                  />
                  {arg.description && <p className="text-[11px] text-muted-foreground">{arg.description}</p>}
                  {promptArgErrors[arg.name] && <p className="text-[11px] text-red-500">This argument is required.</p>}
                </div>
              ))}
            </ModalBody>
            <ModalFooter>
              <Button variant="outline" onClick={() => setPromptArgsRequest(null)}>Cancel</Button>
              <Button onClick={handleSubmitPromptArgs}>Get Prompt</Button>
            </ModalFooter>
          </Modal>
        )}

        {preview && (
          <Modal isOpen={true} onClose={() => setPreview(null)} title={preview.title} size="lg">
            <ModalBody>
              {previewLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Loading...</div>
              ) : (
                <pre className="text-xs whitespace-pre-wrap break-all max-h-[60vh] overflow-y-auto">{preview.content}</pre>
              )}
            </ModalBody>
            <ModalFooter>
              <Button variant="outline" onClick={() => setPreview(null)}>Close</Button>
            </ModalFooter>
          </Modal>
        )}

        <ToastContainer />
      </div>
    )
  }
)

MCPPanel.displayName = 'MCPPanel'

// ---------------------------------------------------------------------------
// Create / edit modal
// ---------------------------------------------------------------------------

interface MCPServerEditorProps {
  server: MCPServer | null
  onSave: (drafts: MCPServerDraft[]) => Promise<void>
  onCancel: () => void
}

const JSON_PLACEHOLDER = `{
  "mcpServers": {
    "my_server": {
      "url": "https://example.com/mcp",
      "headers": { "Authorization": "Bearer <token>" }
    }
  }
}`

function MCPServerEditor({ server, onSave, onCancel }: MCPServerEditorProps) {
  const [mode, setMode] = useState<'form' | 'json'>(server ? 'form' : 'json')
  const [name, setName] = useState(server?.name || '')
  const [url, setUrl] = useState(server?.url || '')
  const [headers, setHeaders] = useState<MCPHeader[]>(server?.headers?.length ? server.headers.map((h) => ({ ...h })) : [{ key: '', value: '' }])
  const [jsonText, setJsonText] = useState('')
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const jsonPreview = useMemo(() => {
    if (mode !== 'json' || !jsonText.trim()) return null
    try {
      return parseMCPServerInput(jsonText)
    } catch (e) {
      return e instanceof Error ? e.message : 'Invalid input'
    }
  }, [mode, jsonText])

  const handleSave = async () => {
    setError('')
    let drafts: MCPServerDraft[]
    try {
      if (mode === 'json') {
        drafts = parseMCPServerInput(jsonText)
      } else {
        if (!/^https?:\/\//i.test(url.trim())) {
          throw new Error('URL must start with http:// or https://')
        }
        drafts = [
          {
            name: name.trim() || new URL(url.trim()).hostname,
            url: url.trim(),
            headers: headers.filter((h) => h.key.trim()).map((h) => ({ key: h.key.trim(), value: h.value }))
          }
        ]
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid input')
      return
    }

    setIsSaving(true)
    try {
      await onSave(drafts)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal isOpen={true} onClose={onCancel} title={server ? `Edit ${server.name}` : 'Add MCP Server'} size="md">
      <ModalBody className="space-y-4">
        {!server && (
          <div className="flex gap-1 border-b border-border">
            {(['json', 'form'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`px-3 py-1 text-xs border-b-2 -mb-px ${mode === m ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
              >
                {m === 'json' ? 'Paste JSON config' : 'Form'}
              </button>
            ))}
          </div>
        )}

        {mode === 'json' ? (
          <div className="space-y-2">
            <Label>mcpServers JSON or server URL</Label>
            <Textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              rows={10}
              placeholder={JSON_PLACEHOLDER}
              className="font-mono text-xs"
            />
            {typeof jsonPreview === 'string' && <p className="text-xs text-red-600">{jsonPreview}</p>}
            {Array.isArray(jsonPreview) && (
              <div className="text-xs text-muted-foreground">
                Will add {jsonPreview.length} server{jsonPreview.length > 1 ? 's' : ''}: {jsonPreview.map((d) => d.name).join(', ')}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Only Streamable HTTP servers (an http(s) URL) are supported. Headers such as Authorization are sent with every request.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="mcp-name">Name</Label>
              <Input id="mcp-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="my_server" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="mcp-url">URL</Label>
              <Input id="mcp-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/mcp" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label>Headers</Label>
                <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => setHeaders((prev) => [...prev, { key: '', value: '' }])}>
                  <Plus className="w-3 h-3 mr-1" /> Add
                </Button>
              </div>
              {headers.map((header, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={header.key}
                    onChange={(e) => setHeaders((prev) => prev.map((h, i) => (i === index ? { ...h, key: e.target.value } : h)))}
                    placeholder="Authorization"
                    className="h-8 text-xs flex-1"
                  />
                  <Input
                    value={header.value}
                    onChange={(e) => setHeaders((prev) => prev.map((h, i) => (i === index ? { ...h, value: e.target.value } : h)))}
                    placeholder="Bearer ..."
                    type="password"
                    className="h-8 text-xs flex-1"
                  />
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setHeaders((prev) => prev.filter((_, i) => i !== index))}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}
      </ModalBody>
      <ModalFooter>
        <Button variant="outline" onClick={onCancel} disabled={isSaving}>Cancel</Button>
        <Button onClick={handleSave} disabled={isSaving || (mode === 'json' ? !jsonText.trim() : !url.trim())}>
          {isSaving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
          {server ? 'Save' : 'Add & Connect'}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
