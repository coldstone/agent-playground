/**
 * Server-side MCP connection manager.
 *
 * Runs only inside Next.js API routes (Node.js). Wraps the official TypeScript SDK v2 client,
 * which is dual-era: it speaks the 2026-07-28 stateless protocol and falls back to the
 * legacy `initialize` handshake (2025-11-25 and earlier) automatically.
 *
 * Connections are cached per (url + headers) so legacy sessions and list_changed
 * subscriptions survive across API requests. Elicitation requests coming from the server
 * (legacy server-initiated requests or modern MRTR `input_required` results) are relayed to
 * the browser through the tool-call event stream and answered via `resolveElicitation`.
 */
import { randomUUID, createHash } from 'crypto'
import { Client, StreamableHTTPClientTransport, SSEClientTransport } from '@modelcontextprotocol/client'
import type { Transport } from '@modelcontextprotocol/client'
import { deepRepairMojibake } from './text'

const CLIENT_INFO = { name: 'agent-playground', version: '0.3.1' }
const IDLE_TTL_MS = 15 * 60 * 1000
const ELICITATION_TIMEOUT_MS = 10 * 60 * 1000
const CALL_TIMEOUT_MS = 2 * 60 * 1000
const CALL_MAX_TOTAL_TIMEOUT_MS = 15 * 60 * 1000

export interface MCPTarget {
  url: string
  headers?: Record<string, string>
}

export type MCPCallEvent =
  | { type: 'progress'; progress: number; total?: number; message?: string }
  | { type: 'log'; level?: string; logger?: string; data: unknown }
  | { type: 'elicitation'; id: string; mode: 'form' | 'url'; message: string; requestedSchema?: unknown; url?: string }
  | { type: 'elicitation_done'; id: string }

export interface MCPCallEmitter {
  emit: (event: MCPCallEvent) => void
}

interface Connection {
  key: string
  target: MCPTarget
  client: Client
  transport: Transport
  transportKind: 'streamable-http' | 'sse'
  connectedAt: number
  lastUsedAt: number
  closed: boolean
  emitters: Set<MCPCallEmitter>
  /** Latest tool list pushed by a tools/list_changed notification */
  tools?: unknown[]
}

interface PendingElicitation {
  resolve: (result: ElicitResultLike) => void
  timer: NodeJS.Timeout
  connectionKey: string
}

export interface ElicitResultLike {
  action: 'accept' | 'decline' | 'cancel'
  content?: Record<string, unknown>
}

// Keep state on globalThis so it survives Next.js dev-mode module reloads
const g = globalThis as typeof globalThis & {
  __mcpConnections?: Map<string, Promise<Connection>>
  __mcpPendingElicitations?: Map<string, PendingElicitation>
  __mcpSweeper?: NodeJS.Timeout
}
const connections: Map<string, Promise<Connection>> = g.__mcpConnections ?? (g.__mcpConnections = new Map())
const pendingElicitations: Map<string, PendingElicitation> =
  g.__mcpPendingElicitations ?? (g.__mcpPendingElicitations = new Map())

if (!g.__mcpSweeper) {
  g.__mcpSweeper = setInterval(() => {
    const now = Date.now()
    connections.forEach((promise, key) => {
      promise
        .then((conn) => {
          if (conn.closed || (now - conn.lastUsedAt > IDLE_TTL_MS && conn.emitters.size === 0)) {
            void closeConnectionEntry(key, conn)
          }
        })
        .catch(() => connections.delete(key))
    })
  }, 60 * 1000)
  g.__mcpSweeper.unref?.()
}

export function targetKey(target: MCPTarget): string {
  const normalizedHeaders = Object.entries(target.headers || {})
    .map(([k, v]) => [k.toLowerCase(), v] as const)
    .sort(([a], [b]) => a.localeCompare(b))
  return createHash('sha256').update(JSON.stringify([target.url.trim(), normalizedHeaders])).digest('hex')
}

function mergeHeaders(base: HeadersInit | undefined, extra: Record<string, string>): Headers {
  const headers = new Headers(base || {})
  for (const [k, v] of Object.entries(extra)) {
    headers.set(k, v)
  }
  return headers
}

function buildFetch(extraHeaders: Record<string, string>) {
  return (url: string | URL, init?: RequestInit) =>
    fetch(url, { ...init, headers: mergeHeaders(init?.headers, extraHeaders) })
}

function isTransportFallbackError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  // Legacy HTTP+SSE servers answer the modern POST with 4xx (typically 404/405/400)
  return /\b(400|404|405)\b/.test(message) || /Not Found|Method Not Allowed|Bad Request/i.test(message)
}

function isNegotiationError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  // Some legacy servers answer the server/discover probe with a 5xx instead of a JSON-RPC error.
  // The SDK reports that as a negotiation failure; we retry with the plain legacy handshake.
  return /version negotiation|server\/discover|probe/i.test(message)
}

type NegotiationMode = 'auto' | 'legacy'

function createClient(conn: () => Connection | undefined, negotiation: NegotiationMode): Client {
  const client = new Client(CLIENT_INFO, {
    // 'auto' probes for the 2026-07-28 stateless protocol and falls back to the legacy
    // initialize handshake on a recognised legacy answer; 'legacy' skips the probe entirely
    versionNegotiation: { mode: negotiation },
    capabilities: {
      elicitation: { form: {}, url: {} }
    },
    listChanged: {
      tools: {
        autoRefresh: true,
        onChanged: (error, items) => {
          const current = conn()
          if (!error && items && current) {
            current.tools = items
          }
        }
      }
    }
  })

  // Elicitation: relay to the browser over the active tool-call stream(s) and wait for the answer.
  // Used both for legacy server-initiated requests and for modern MRTR input_required rounds.
  client.setRequestHandler('elicitation/create', async (request) => {
    const current = conn()
    const params = request.params as {
      mode?: 'form' | 'url'
      message: string
      requestedSchema?: unknown
      url?: string
    }
    if (!current || current.emitters.size === 0) {
      // Nobody is listening (e.g. call not initiated through our API) - decline politely
      return { action: 'cancel' }
    }

    const id = randomUUID()
    const mode = params.mode === 'url' ? 'url' : 'form'
    const result = await new Promise<ElicitResultLike>((resolve) => {
      const timer = setTimeout(() => {
        pendingElicitations.delete(id)
        resolve({ action: 'cancel' })
      }, ELICITATION_TIMEOUT_MS)
      pendingElicitations.set(id, { resolve, timer, connectionKey: current.key })
      current.emitters.forEach((emitter) => {
        emitter.emit({
          type: 'elicitation',
          id,
          mode,
          message: params.message,
          requestedSchema: params.requestedSchema,
          url: params.url
        })
      })
    })

    current.emitters.forEach((emitter) => emitter.emit({ type: 'elicitation_done', id }))
    return result as never
  })

  client.setNotificationHandler('notifications/message', (notification) => {
    const current = conn()
    if (!current) return
    const params = notification.params as { level?: string; logger?: string; data?: unknown }
    current.emitters.forEach((emitter) =>
      emitter.emit({ type: 'log', level: params.level, logger: params.logger, data: params.data })
    )
  })

  return client
}

async function openConnection(target: MCPTarget, key: string): Promise<Connection> {
  const url = new URL(target.url)
  const extraHeaders = target.headers || {}
  const fetchWithHeaders = buildFetch(extraHeaders)

  let connection: Connection | undefined

  const attempt = async (kind: Connection['transportKind'], negotiation: NegotiationMode) => {
    const client = createClient(() => connection, negotiation)
    const transport: Transport =
      kind === 'streamable-http'
        ? new StreamableHTTPClientTransport(url, { fetch: fetchWithHeaders, requestInit: { headers: extraHeaders } })
        : new SSEClientTransport(url, { fetch: fetchWithHeaders, requestInit: { headers: extraHeaders } })
    try {
      await client.connect(transport)
    } catch (error) {
      await client.close().catch(() => undefined)
      throw error
    }
    return { client, transport }
  }

  // 1. Streamable HTTP, modern-first negotiation (spec 2026-07-28 with legacy fallback)
  // 2. Streamable HTTP, forced legacy handshake (servers that choke on the server/discover probe)
  // 3. Deprecated HTTP+SSE transport (protocol 2024-11-05)
  let client: Client
  let transport: Transport
  let transportKind: Connection['transportKind'] = 'streamable-http'
  try {
    ;({ client, transport } = await attempt('streamable-http', 'auto'))
  } catch (autoError) {
    if (isNegotiationError(autoError)) {
      ;({ client, transport } = await attempt('streamable-http', 'legacy'))
    } else if (isTransportFallbackError(autoError)) {
      try {
        ;({ client, transport } = await attempt('streamable-http', 'legacy'))
      } catch (legacyError) {
        if (!isTransportFallbackError(legacyError)) throw legacyError
        transportKind = 'sse'
        ;({ client, transport } = await attempt('sse', 'legacy'))
      }
    } else {
      throw autoError
    }
  }

  connection = {
    key,
    target,
    client,
    transport,
    transportKind,
    connectedAt: Date.now(),
    lastUsedAt: Date.now(),
    closed: false,
    emitters: new Set()
  }

  const conn = connection
  transport.onclose = () => {
    conn.closed = true
    connections.delete(key)
  }
  transport.onerror = () => {
    /* errors surface on the pending request; keep the connection until close */
  }

  return connection
}

export async function getConnection(target: MCPTarget, options: { force?: boolean } = {}): Promise<Connection> {
  const key = targetKey(target)
  if (options.force) {
    await closeConnection(target)
  }
  let promise = connections.get(key)
  if (promise) {
    const existing = await promise.catch(() => undefined)
    if (existing && !existing.closed) {
      existing.lastUsedAt = Date.now()
      return existing
    }
    connections.delete(key)
  }
  promise = openConnection(target, key)
  connections.set(key, promise)
  try {
    return await promise
  } catch (error) {
    connections.delete(key)
    throw error
  }
}

async function closeConnectionEntry(key: string, conn: Connection): Promise<void> {
  connections.delete(key)
  conn.closed = true
  try {
    await conn.client.close()
  } catch {
    /* ignore */
  }
}

export async function closeConnection(target: MCPTarget): Promise<boolean> {
  const key = targetKey(target)
  const promise = connections.get(key)
  if (!promise) return false
  const conn = await promise.catch(() => undefined)
  if (conn) {
    await closeConnectionEntry(key, conn)
  } else {
    connections.delete(key)
  }
  return true
}

export interface ServerDescription {
  serverInfo?: { name: string; version: string; title?: string }
  protocolVersion?: string
  protocolEra?: 'legacy' | 'modern'
  transport: Connection['transportKind']
  capabilities?: Record<string, unknown>
  instructions?: string
  tools: unknown[]
  resources: unknown[]
  resourceTemplates: unknown[]
  prompts: unknown[]
}

export async function describeServer(target: MCPTarget, options: { force?: boolean } = {}): Promise<ServerDescription> {
  const conn = await getConnection(target, options)
  const { client } = conn
  const capabilities = (client.getServerCapabilities() || {}) as Record<string, unknown>
  const cacheMode = options.force ? 'bypass' : 'use'

  const tools = capabilities.tools ? (await client.listTools(undefined, { cacheMode })).tools : []
  conn.tools = tools

  let resources: unknown[] = []
  let resourceTemplates: unknown[] = []
  if (capabilities.resources) {
    resources = await client
      .listResources(undefined, { cacheMode })
      .then((r) => r.resources)
      .catch(() => [])
    resourceTemplates = await client
      .listResourceTemplates(undefined, { cacheMode })
      .then((r) => r.resourceTemplates)
      .catch(() => [])
  }

  const prompts = capabilities.prompts
    ? await client
        .listPrompts(undefined, { cacheMode })
        .then((r) => r.prompts)
        .catch(() => [])
    : []

  // Some servers double-encode their UTF-8 metadata; repair it before it reaches the UI.
  // Tool call results are deliberately left alone (they may carry binary/base64 payloads).
  return deepRepairMojibake({
    serverInfo: client.getServerVersion(),
    protocolVersion: client.getNegotiatedProtocolVersion(),
    protocolEra: client.getProtocolEra(),
    transport: conn.transportKind,
    capabilities,
    instructions: client.getInstructions(),
    tools,
    resources,
    resourceTemplates,
    prompts
  })
}

export async function callTool(
  target: MCPTarget,
  name: string,
  args: Record<string, unknown>,
  emitter: MCPCallEmitter,
  signal?: AbortSignal
): Promise<unknown> {
  const conn = await getConnection(target)
  conn.emitters.add(emitter)
  conn.lastUsedAt = Date.now()
  try {
    const toolDefinition = (conn.tools as Array<{ name: string }> | undefined)?.find((t) => t.name === name)
    return await conn.client.callTool(
      { name, arguments: args },
      {
        onprogress: (p) => emitter.emit({ type: 'progress', progress: p.progress, total: p.total, message: p.message }),
        resetTimeoutOnProgress: true,
        timeout: CALL_TIMEOUT_MS,
        maxTotalTimeout: CALL_MAX_TOTAL_TIMEOUT_MS,
        signal,
        toolDefinition: toolDefinition as never
      }
    )
  } finally {
    conn.emitters.delete(emitter)
    conn.lastUsedAt = Date.now()
  }
}

export async function readResource(target: MCPTarget, uri: string): Promise<unknown> {
  const conn = await getConnection(target)
  return conn.client.readResource({ uri })
}

export async function getPrompt(target: MCPTarget, name: string, args?: Record<string, string>): Promise<unknown> {
  const conn = await getConnection(target)
  return conn.client.getPrompt({ name, arguments: args })
}

export function resolveElicitation(id: string, result: ElicitResultLike): boolean {
  const pending = pendingElicitations.get(id)
  if (!pending) return false
  clearTimeout(pending.timer)
  pendingElicitations.delete(id)
  pending.resolve(result)
  return true
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    const cause = (error as Error & { cause?: unknown }).cause
    const causeMessage = cause instanceof Error ? cause.message : typeof cause === 'string' ? cause : ''
    return causeMessage && !error.message.includes(causeMessage) ? `${error.message} (${causeMessage})` : error.message
  }
  return typeof error === 'string' ? error : JSON.stringify(error)
}
