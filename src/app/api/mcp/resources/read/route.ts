import { NextResponse } from 'next/server'
import { readResource, errorMessage } from '@/lib/mcp/server/connection-manager'
import { parseTarget, isErrorResponse } from '@/lib/mcp/server/request'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Read a resource. Body: { url, headers?, uri } */
export async function POST(request: Request) {
  const parsed = await parseTarget(request)
  if (isErrorResponse(parsed)) return parsed

  const uri = typeof parsed.body.uri === 'string' ? parsed.body.uri : ''
  if (!uri) {
    return NextResponse.json({ error: 'uri is required' }, { status: 400 })
  }

  try {
    const result = await readResource(parsed.target, uri)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 502 })
  }
}
