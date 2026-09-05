import { NextResponse } from 'next/server'
import type { MCPTarget } from './connection-manager'

export interface ParsedTarget {
  target: MCPTarget
  body: Record<string, any>
}

/**
 * Validate the common { url, headers } part of every MCP API request body.
 */
export async function parseTarget(request: Request): Promise<ParsedTarget | NextResponse> {
  let body: Record<string, any>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const url = typeof body.url === 'string' ? body.url.trim() : ''
  if (!/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: 'url must start with http:// or https://' }, { status: 400 })
  }

  const headers: Record<string, string> = {}
  if (body.headers && typeof body.headers === 'object' && !Array.isArray(body.headers)) {
    for (const [key, value] of Object.entries(body.headers)) {
      if (typeof value === 'string' && key.trim()) {
        headers[key.trim()] = value
      }
    }
  }

  return { target: { url, headers }, body }
}

export function isErrorResponse(value: ParsedTarget | NextResponse): value is NextResponse {
  return value instanceof NextResponse
}
