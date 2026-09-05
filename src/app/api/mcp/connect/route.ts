import { NextResponse } from 'next/server'
import { describeServer, errorMessage } from '@/lib/mcp/server/connection-manager'
import { parseTarget, isErrorResponse } from '@/lib/mcp/server/request'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Connect to an MCP server (or reuse the cached connection) and return its
 * identity, capabilities and the full tool / resource / prompt catalogue.
 * Body: { url, headers?, refresh?: boolean }
 */
export async function POST(request: Request) {
  const parsed = await parseTarget(request)
  if (isErrorResponse(parsed)) return parsed

  try {
    const description = await describeServer(parsed.target, { force: parsed.body.refresh === true })
    return NextResponse.json(description)
  } catch (error) {
    console.error('[MCP] connect failed:', error)
    return NextResponse.json({ error: errorMessage(error) }, { status: 502 })
  }
}
