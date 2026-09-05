import { NextResponse } from 'next/server'
import { getPrompt, errorMessage } from '@/lib/mcp/server/connection-manager'
import { parseTarget, isErrorResponse } from '@/lib/mcp/server/request'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Get a prompt. Body: { url, headers?, name, arguments? } */
export async function POST(request: Request) {
  const parsed = await parseTarget(request)
  if (isErrorResponse(parsed)) return parsed

  const name = typeof parsed.body.name === 'string' ? parsed.body.name : ''
  if (!name) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const args: Record<string, string> = {}
  if (parsed.body.arguments && typeof parsed.body.arguments === 'object') {
    for (const [key, value] of Object.entries(parsed.body.arguments as Record<string, unknown>)) {
      if (value !== undefined && value !== null) args[key] = String(value)
    }
  }

  try {
    const result = await getPrompt(parsed.target, name, args)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 502 })
  }
}
