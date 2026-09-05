/**
 * Browser-side MCP helpers. Talks to the Next.js API routes under /api/mcp,
 * never to MCP servers directly (no CORS, credentials stay on the server hop).
 */
import {
  MCPServer,
  MCPHeader,
  MCPToolInfo,
  MCPToolProgress,
  MCPContentBlock,
  MCPCallToolResult,
  MCPElicitationRequest,
  MCPElicitResult,
  Tool
} from '@/types'

export const MCP_TOOL_ID_PREFIX = 'mcp:'

export interface MCPServerDraft {
  name: string
  url: string
  headers: MCPHeader[]
}

export interface MCPConnectResponse {
  serverInfo?: MCPServer['serverInfo']
  protocolVersion?: string
  protocolEra?: MCPServer['protocolEra']
  transport?: 'streamable-http' | 'sse'
  capabilities?: Record<string, unknown>
  instructions?: string
  tools: MCPToolInfo[]
  resources: MCPServer['resources']
  resourceTemplates: MCPServer['resourceTemplates']
  prompts: MCPServer['prompts']
}

export interface MCPLogEvent {
  level?: string
  logger?: string
  data: unknown
}

export interface CallMCPToolOptions {
  onProgress?: (progress: MCPToolProgress) => void
  onLog?: (log: MCPLogEvent) => void
  onElicitation?: (request: MCPElicitationRequest) => void
  onElicitationDone?: (id: string) => void
  signal?: AbortSignal
}

export function headersToRecord(headers: MCPHeader[] | undefined): Record<string, string> {
  const record: Record<string, string> = {}
  for (const header of headers || []) {
    if (header.key.trim() && header.value) {
      record[header.key.trim()] = header.value
    }
  }
  return record
}

export function recordToHeaders(record: Record<string, unknown> | undefined): MCPHeader[] {
  return Object.entries(record || {})
    .filter(([key, value]) => key.trim() && typeof value === 'string')
    .map(([key, value]) => ({ key: key.trim(), value: value as string }))
}

/**
 * Parse user input into server drafts. Accepts:
 * - the common `{ "mcpServers": { "<name>": { "url": ..., "headers": {...} } } }` config JSON
 * - a single server object `{ "name"?, "url", "headers"? }`
 * - a bare URL
 */
export function parseMCPServerInput(input: string): MCPServerDraft[] {
  const text = input.trim()
  if (!text) return []

  if (/^https?:\/\//i.test(text) && !text.includes('{')) {
    return [{ name: deriveNameFromUrl(text), url: text, headers: [] }]
  }

  let parsed: any
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('Input is neither a URL nor valid JSON')
  }

  const drafts: MCPServerDraft[] = []
  const pushEntry = (name: string | undefined, entry: any) => {
    if (!entry || typeof entry !== 'object') return
    const url = typeof entry.url === 'string' ? entry.url : typeof entry.serverUrl === 'string' ? entry.serverUrl : ''
    if (!/^https?:\/\//i.test(url)) {
      throw new Error(`Server "${name || 'unnamed'}" has no valid http(s) url (stdio servers are not supported)`)
    }
    drafts.push({
      name: (name || entry.name || deriveNameFromUrl(url)).toString(),
      url,
      headers: recordToHeaders(entry.headers)
    })
  }

  if (parsed && typeof parsed === 'object' && parsed.mcpServers && typeof parsed.mcpServers === 'object') {
    for (const [name, entry] of Object.entries(parsed.mcpServers)) {
      pushEntry(name, entry)
    }
  } else if (Array.isArray(parsed)) {
    parsed.forEach((entry) => pushEntry(entry?.name, entry))
  } else {
    pushEntry(parsed?.name, parsed)
  }

  if (drafts.length === 0) {
    throw new Error('No MCP servers found in the input')
  }
  return drafts
}

export function deriveNameFromUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const host = parsed.hostname.replace(/^www\./, '')
    return host || url
  } catch {
    return url
  }
}

/**
 * Fill in the array/scalar fields a persisted record may be missing so the UI and the
 * tool pipeline can read them without defensive checks. Every other field is kept as-is.
 *
 * Also migrates records written by the earlier implementation of this store, which used
 * `endpoint` instead of `url` and had no headers/disabledTools/resourceTemplates. Those
 * records are forced to disabled: they were never validated against the current code, so
 * they must not auto-connect or expose tools on load until the user re-enables them.
 */
export function normalizeMCPServer(server: Partial<MCPServer> & { id: string }): MCPServer {
  const now = Date.now()
  const legacyEndpoint = (server as { endpoint?: unknown }).endpoint
  const isLegacyRecord = !server.url && typeof legacyEndpoint === 'string' && legacyEndpoint.length > 0
  const url = server.url || (isLegacyRecord ? (legacyEndpoint as string) : '')
  return {
    ...server,
    id: server.id,
    name: server.name || (url ? deriveNameFromUrl(url) : '') || 'MCP Server',
    url,
    headers: server.headers ?? [],
    enabled: isLegacyRecord ? false : server.enabled ?? true,
    disabledTools: server.disabledTools ?? [],
    tools: server.tools ?? [],
    resources: server.resources ?? [],
    resourceTemplates: server.resourceTemplates ?? [],
    prompts: server.prompts ?? [],
    status: isLegacyRecord ? 'idle' : server.status ?? 'idle',
    createdAt: server.createdAt ?? now,
    updatedAt: server.updatedAt ?? now
  }
}

async function postJSON<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data?.error || data?.message || `${response.status} ${response.statusText}`)
  }
  return data as T
}

export function connectMCPServer(server: Pick<MCPServer, 'url' | 'headers'>, refresh = false): Promise<MCPConnectResponse> {
  return postJSON<MCPConnectResponse>('/api/mcp/connect', {
    url: server.url,
    headers: headersToRecord(server.headers),
    refresh
  })
}

export function disconnectMCPServer(server: Pick<MCPServer, 'url' | 'headers'>): Promise<{ closed: boolean }> {
  return postJSON('/api/mcp/disconnect', { url: server.url, headers: headersToRecord(server.headers) })
}

export function readMCPResource(server: Pick<MCPServer, 'url' | 'headers'>, uri: string): Promise<{ contents: MCPContentBlock['resource'][] }> {
  return postJSON('/api/mcp/resources/read', { url: server.url, headers: headersToRecord(server.headers), uri })
}

export function getMCPPrompt(
  server: Pick<MCPServer, 'url' | 'headers'>,
  name: string,
  args?: Record<string, string>
): Promise<{ description?: string; messages: Array<{ role: string; content: MCPContentBlock }> }> {
  return postJSON('/api/mcp/prompts/get', { url: server.url, headers: headersToRecord(server.headers), name, arguments: args })
}

export function respondMCPElicitation(id: string, result: MCPElicitResult): Promise<{ ok: boolean }> {
  return postJSON('/api/mcp/elicitation', { id, result })
}

/**
 * Call a tool and consume the SSE event stream produced by /api/mcp/tools/call.
 */
export async function callMCPTool(
  server: Pick<MCPServer, 'url' | 'headers'>,
  toolName: string,
  args: Record<string, unknown>,
  options: CallMCPToolOptions = {}
): Promise<MCPCallToolResult> {
  const response = await fetch('/api/mcp/tools/call', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: server.url, headers: headersToRecord(server.headers), name: toolName, arguments: args }),
    signal: options.signal
  })

  if (!response.ok || !response.body) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data?.error || `${response.status} ${response.statusText}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let finalResult: MCPCallToolResult | undefined
  let finalError: string | undefined

  const handleEvent = (payload: any) => {
    switch (payload?.type) {
      case 'progress':
        options.onProgress?.({ progress: payload.progress, total: payload.total, message: payload.message })
        break
      case 'log':
        options.onLog?.({ level: payload.level, logger: payload.logger, data: payload.data })
        break
      case 'elicitation':
        options.onElicitation?.({
          id: payload.id,
          serverUrl: server.url,
          mode: payload.mode === 'url' ? 'url' : 'form',
          message: payload.message,
          requestedSchema: payload.requestedSchema,
          url: payload.url
        })
        break
      case 'elicitation_done':
        options.onElicitationDone?.(payload.id)
        break
      case 'result':
        finalResult = normalizeCallToolResult(payload.result)
        break
      case 'error':
        finalError = payload.error || 'MCP tool call failed'
        break
    }
  }

  const processChunk = (chunk: string) => {
    buffer += chunk
    let separator = buffer.indexOf('\n\n')
    while (separator !== -1) {
      const rawEvent = buffer.slice(0, separator)
      buffer = buffer.slice(separator + 2)
      const dataLines = rawEvent
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
      if (dataLines.length > 0) {
        try {
          handleEvent(JSON.parse(dataLines.join('\n')))
        } catch (error) {
          console.error('Failed to parse MCP event:', error)
        }
      }
      separator = buffer.indexOf('\n\n')
    }
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    processChunk(decoder.decode(value, { stream: true }))
  }
  processChunk(decoder.decode())
  if (buffer.trim()) processChunk('\n\n')

  if (finalError) throw new Error(finalError)
  if (!finalResult) throw new Error('MCP tool call ended without a result')
  return finalResult
}

export function normalizeCallToolResult(raw: any): MCPCallToolResult {
  const content = Array.isArray(raw?.content) ? (raw.content as MCPContentBlock[]) : []
  const result: MCPCallToolResult = { content }
  if (raw && 'structuredContent' in raw && raw.structuredContent !== undefined) {
    result.structuredContent = raw.structuredContent
  }
  if (raw?.isError) result.isError = true
  // Legacy servers may return { toolResult } instead of content blocks
  if (content.length === 0 && raw && 'toolResult' in raw) {
    result.content = [{ type: 'text', text: typeof raw.toolResult === 'string' ? raw.toolResult : JSON.stringify(raw.toolResult, null, 2) }]
  }
  return result
}

/**
 * Turn a CallToolResult into the plain-text tool result handed back to the LLM.
 */
export function formatMCPToolResult(result: MCPCallToolResult): string {
  const parts: string[] = []
  for (const block of result.content) {
    switch (block.type) {
      case 'text':
        if (typeof block.text === 'string') parts.push(block.text)
        break
      case 'image':
        parts.push(`[image ${block.mimeType || 'unknown type'}, ${estimateBase64Bytes(block.data)} bytes]`)
        break
      case 'audio':
        parts.push(`[audio ${block.mimeType || 'unknown type'}, ${estimateBase64Bytes(block.data)} bytes]`)
        break
      case 'resource_link':
        parts.push(`[resource link] ${block.title || block.name || ''} ${block.uri || ''}${block.mimeType ? ` (${block.mimeType})` : ''}${block.description ? ` - ${block.description}` : ''}`.trim())
        break
      case 'resource': {
        const resource = block.resource
        if (resource?.text !== undefined) {
          parts.push(`[resource ${resource.uri}]\n${resource.text}`)
        } else if (resource) {
          parts.push(`[resource ${resource.uri}${resource.mimeType ? ` (${resource.mimeType})` : ''}, binary ${estimateBase64Bytes(resource.blob)} bytes]`)
        }
        break
      }
      default:
        parts.push(JSON.stringify(block))
    }
  }

  if (result.structuredContent !== undefined) {
    const structured = JSON.stringify(result.structuredContent, null, 2)
    // Avoid duplicating when the text block is just the serialized structured content
    if (!parts.some((p) => p.trim() === structured.trim() || p.trim() === JSON.stringify(result.structuredContent))) {
      parts.push(parts.length > 0 ? `structuredContent:\n${structured}` : structured)
    }
  }

  return parts.join('\n\n').trim()
}

function estimateBase64Bytes(data: unknown): number {
  if (typeof data !== 'string') return 0
  return Math.floor((data.length * 3) / 4)
}

/**
 * Build a function-calling safe name: [a-zA-Z0-9_-], max 64 chars.
 */
export function sanitizeFunctionName(name: string): string {
  const cleaned = name.replace(/[^a-zA-Z0-9_-]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '')
  return (cleaned || 'tool').slice(0, 64)
}

export function isMCPTool(tool: Tool | undefined | null): tool is Tool & { mcp: NonNullable<Tool['mcp']> } {
  return !!tool?.mcp
}

export function mcpToolId(serverId: string, toolName: string): string {
  return `${MCP_TOOL_ID_PREFIX}${serverId}:${toolName}`
}

export function isToolEnabled(server: MCPServer, toolName: string): boolean {
  return !(server.disabledTools ?? []).includes(toolName)
}

/**
 * Convert the enabled tools of the enabled servers into the app's Tool shape so
 * the rest of the chat pipeline (schemas, execution, display) can treat them uniformly.
 * Duplicate function names across servers are disambiguated with a server prefix.
 */
export function buildMCPTools(servers: MCPServer[], reservedNames: string[] = []): Tool[] {
  const tools: Tool[] = []
  const usedNames = new Set<string>()

  // Names already taken by local or built-in tools: an MCP tool must never be offered to the
  // model under a name that another tool already uses, or the call becomes ambiguous.
  reservedNames.forEach((name) => usedNames.add(sanitizeFunctionName(name)))

  for (const server of servers) {
    if (!server.enabled) continue
    for (const info of server.tools ?? []) {
      if (!isToolEnabled(server, info.name)) continue

      let functionName = sanitizeFunctionName(info.name)
      if (usedNames.has(functionName)) {
        functionName = sanitizeFunctionName(`${server.name}__${info.name}`)
        let suffix = 2
        while (usedNames.has(functionName)) {
          functionName = sanitizeFunctionName(`${server.name}__${info.name}_${suffix++}`)
        }
      }
      usedNames.add(functionName)

      const inputSchema = normalizeInputSchema(info.inputSchema)
      const description = info.description || info.title || info.annotations?.title || info.name

      tools.push({
        id: mcpToolId(server.id, info.name),
        name: functionName,
        description,
        schema: {
          type: 'function',
          function: {
            name: functionName,
            description,
            parameters: inputSchema
          }
        },
        mcp: {
          serverId: server.id,
          serverName: server.name,
          toolName: info.name,
          annotations: info.annotations,
          outputSchema: info.outputSchema
        },
        tag: `MCP: ${server.name}`,
        createdAt: server.createdAt,
        updatedAt: server.updatedAt
      })
    }
  }

  return tools
}

function normalizeInputSchema(schema: Record<string, any> | undefined): Tool['schema']['function']['parameters'] {
  const base = schema && typeof schema === 'object' ? { ...schema } : {}
  return {
    ...base,
    type: 'object',
    properties: base.properties && typeof base.properties === 'object' ? base.properties : {},
    ...(Array.isArray(base.required) ? { required: base.required } : {})
  }
}

/** Human readable elicitation summary for the tool call timeline */
export function describeElicitation(request: MCPElicitationRequest): string {
  return request.mode === 'url' ? `Server asks you to open: ${request.url}` : request.message
}
