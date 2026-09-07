/**
 * POST /api/search - the server half of the built-in web_search tool.
 *
 * Tavily does not allow browser-origin requests, so the call is made here. The user's API key
 * travels in the request body on every call, exactly like the LLM keys and MCP headers: it is
 * used to build one Authorization header and is never stored, logged or echoed back.
 */
import { NextRequest, NextResponse } from 'next/server'
import { runWebSearch, WebSearchError } from '@/lib/web-search/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  try {
    const result = await runWebSearch({
      apiKey: typeof body?.apiKey === 'string' ? body.apiKey : '',
      query: typeof body?.query === 'string' ? body.query : '',
      maxResults: body?.maxResults,
      topic: body?.topic,
      timeRange: body?.timeRange,
      searchDepth: body?.searchDepth,
      includeDomains: body?.includeDomains
    })
    return NextResponse.json(result)
  } catch (error: any) {
    if (error instanceof WebSearchError) {
      // 401/429/432/433 are the user's problem to fix, 400 is a bad request: pass the status
      // through so the client can tell them apart. Never include the body, it holds the key.
      const status = error.status && error.status >= 400 && error.status < 600 ? error.status : 502
      return NextResponse.json({ error: error.message, status: error.status }, { status })
    }
    return NextResponse.json({ error: 'Unexpected error while searching.' }, { status: 502 })
  }
}
