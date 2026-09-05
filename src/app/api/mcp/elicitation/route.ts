import { NextResponse } from 'next/server'
import { resolveElicitation } from '@/lib/mcp/server/connection-manager'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Answer an elicitation request that was relayed on a tools/call stream.
 * Body: { id, result: { action: 'accept' | 'decline' | 'cancel', content? } }
 */
export async function POST(request: Request) {
  let body: { id?: string; result?: { action?: string; content?: unknown } }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const id = typeof body.id === 'string' ? body.id : ''
  const action = body.result?.action
  if (!id || (action !== 'accept' && action !== 'decline' && action !== 'cancel')) {
    return NextResponse.json({ error: 'id and result.action are required' }, { status: 400 })
  }

  const content =
    action === 'accept' && body.result?.content && typeof body.result.content === 'object'
      ? (body.result.content as Record<string, unknown>)
      : undefined

  const resolved = resolveElicitation(id, action === 'accept' ? { action, content: content || {} } : { action })
  if (!resolved) {
    return NextResponse.json({ error: 'Unknown or expired elicitation id' }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
