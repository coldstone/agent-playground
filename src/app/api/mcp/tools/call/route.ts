import { NextResponse } from 'next/server'
import { callTool, errorMessage, MCPCallEvent } from '@/lib/mcp/server/connection-manager'
import { parseTarget, isErrorResponse } from '@/lib/mcp/server/request'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Call an MCP tool and stream what happens back to the browser as Server-Sent Events:
 *   data: {"type":"progress", ...}      notifications/progress relayed from the server
 *   data: {"type":"log", ...}           notifications/message relayed from the server
 *   data: {"type":"elicitation", ...}   the server needs user input (answer via /api/mcp/elicitation)
 *   data: {"type":"result", "result"}   final CallToolResult
 *   data: {"type":"error", "error"}     the call failed
 * Body: { url, headers?, name, arguments? }
 */
export async function POST(request: Request) {
  const parsed = await parseTarget(request)
  if (isErrorResponse(parsed)) return parsed

  const name = typeof parsed.body.name === 'string' ? parsed.body.name : ''
  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }
  const args =
    parsed.body.arguments && typeof parsed.body.arguments === 'object' && !Array.isArray(parsed.body.arguments)
      ? (parsed.body.arguments as Record<string, unknown>)
      : {}

  const encoder = new TextEncoder()
  const abortController = new AbortController()

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false
      const send = (payload: unknown) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
        } catch {
          closed = true
        }
      }
      const finish = () => {
        if (closed) return
        closed = true
        try {
          controller.close()
        } catch {
          /* already closed */
        }
      }

      // Keep intermediaries from closing the stream while a long tool call runs
      const keepAlive = setInterval(() => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`: keep-alive\n\n`))
        } catch {
          closed = true
        }
      }, 15000)

      const emitter = { emit: (event: MCPCallEvent) => send(event) }

      callTool(parsed.target, name, args, emitter, abortController.signal)
        .then((result) => send({ type: 'result', result }))
        .catch((error) => {
          console.error('[MCP] tools/call failed:', error)
          send({ type: 'error', error: errorMessage(error) })
        })
        .finally(() => {
          clearInterval(keepAlive)
          finish()
        })
    },
    cancel() {
      // Browser went away: cancel the in-flight MCP request (closing its stream is the cancel signal)
      abortController.abort()
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no'
    }
  })
}
