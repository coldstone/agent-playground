import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { method, url, headers, data } = body

    // Validate required fields
    if (!method || !url) {
      return NextResponse.json(
        { error: 'Method and URL are required' },
        { status: 400 }
      )
    }

    // Validate URL format
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return NextResponse.json(
        { error: 'URL must start with http:// or https://' },
        { status: 400 }
      )
    }

    // Prepare fetch options
    const fetchOptions: RequestInit = {
      method: method.toUpperCase(),
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    }

    // Add body for methods that support it
    if (['POST', 'PUT', 'PATCH'].includes(method.toUpperCase()) && data) {
      fetchOptions.body = JSON.stringify(data)
    }

    // Make the request
    const response = await fetch(url, fetchOptions)
    
    // Get response data
    let responseData
    const contentType = response.headers.get('content-type')
    
    if (contentType && contentType.includes('application/json')) {
      try {
        responseData = await response.json()
      } catch (e) {
        responseData = await response.text()
      }
    } else {
      responseData = await response.text()
    }

    // Return the response
    return NextResponse.json({
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      data: responseData
    })

  } catch (error) {
    console.error('Proxy request failed:', error)
    
    return NextResponse.json(
      { 
        error: 'Proxy request failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
