/**
 * POST /api/fetch - the server half of the built-in web_fetch tool.
 *
 * The browser cannot fetch arbitrary sites (CORS), and the conversion pipeline needs a DOM and
 * DNS, so the work happens here. This is the only module that imports src/lib/web-fetch/server.
 */
import { NextRequest, NextResponse } from 'next/server'
import { fetchUrlContent, WebFetchError } from '@/lib/web-fetch/server'

// linkedom and @mdream/js are ESM and need the Node runtime, not the edge one.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const url = typeof body?.url === 'string' ? body.url.trim() : ''
  if (!url) {
    return NextResponse.json({ error: 'A "url" is required.' }, { status: 400 })
  }

  try {
    const result = await fetchUrlContent({
      url,
      mode: body.mode,
      maxLength: body.maxLength,
      startIndex: body.startIndex,
      // Pass the user's language through so sites that negotiate content return what they expect.
      acceptLanguage: request.headers.get('accept-language') || undefined
    })
    return NextResponse.json(result)
  } catch (error: any) {
    if (error instanceof WebFetchError) {
      return NextResponse.json(
        { error: error.message, status: error.status },
        // 400 for "this URL is not fetchable", 502 for "the other end misbehaved".
        { status: error.status && error.status >= 400 ? 502 : 400 }
      )
    }
    return NextResponse.json(
      { error: 'Unexpected error while fetching: ' + ((error && error.message) || 'unknown') },
      { status: 502 }
    )
  }
}
