import { NextResponse } from 'next/server'
import { closeConnection, errorMessage } from '@/lib/mcp/server/connection-manager'
import { parseTarget, isErrorResponse } from '@/lib/mcp/server/request'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Close the cached connection for { url, headers }. */
export async function POST(request: Request) {
  const parsed = await parseTarget(request)
  if (isErrorResponse(parsed)) return parsed

  try {
    const closed = await closeConnection(parsed.target)
    return NextResponse.json({ closed })
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 })
  }
}
