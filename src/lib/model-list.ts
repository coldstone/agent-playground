import { APIConfig } from '@/types'
import { MODEL_PROVIDERS } from '@/lib/providers'

export interface FetchModelsResult {
  models: string[]
  /** The URL that was actually requested, useful for error messages */
  url: string
}

const DEFAULT_AZURE_API_VERSION = '2025-04-01-preview'

/**
 * Derive the OpenAI-compatible `/models` URL from a chat completions endpoint.
 * Examples:
 *   https://api.openai.com/v1/chat/completions -> https://api.openai.com/v1/models
 *   https://api.ppio.com/openai/v1             -> https://api.ppio.com/openai/v1/models
 *   https://api.deepseek.com/chat/completions  -> https://api.deepseek.com/models
 */
export function deriveModelsUrl(endpoint: string): string {
  let base = endpoint.trim().replace(/\/+$/, '')
  base = base.replace(/\/chat\/completions$/i, '')
  base = base.replace(/\/models$/i, '')
  return `${base}/models`
}

/**
 * Build the Azure OpenAI deployments listing URL.
 * Deployment names are what the chat API expects as "model".
 */
export function buildAzureDeploymentsUrl(endpoint: string, apiVersion?: string): string {
  let resource = endpoint.trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '')
  const version = (apiVersion && apiVersion.trim()) || DEFAULT_AZURE_API_VERSION
  return `https://${resource}/openai/deployments?api-version=${encodeURIComponent(version)}`
}

/**
 * Extract model ids from the various response shapes providers return.
 * - OpenAI compatible: { data: [{ id }] }
 * - Ollama native:     { models: [{ name | model }] }
 * - Plain array:       [{ id }] or ['model-id']
 */
export function extractModelIds(payload: unknown): string[] {
  const list: unknown[] = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as any)?.data)
      ? (payload as any).data
      : Array.isArray((payload as any)?.models)
        ? (payload as any).models
        : []

  const ids = list
    .map((item) => {
      if (typeof item === 'string') return item
      if (item && typeof item === 'object') {
        const obj = item as Record<string, unknown>
        const id = obj.id ?? obj.name ?? obj.model
        return typeof id === 'string' ? id : ''
      }
      return ''
    })
    .map((id) => id.trim())
    .filter((id) => id.length > 0)

  return Array.from(new Set(ids)).sort((a, b) => a.localeCompare(b))
}

async function requestViaProxy(url: string, headers: Record<string, string>): Promise<{ status: number; statusText: string; data: unknown }> {
  const response = await fetch('/api/proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method: 'GET', url, headers })
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(body?.message || body?.error || `Proxy request failed (${response.status})`)
  }
  return { status: body.status, statusText: body.statusText, data: body.data }
}

function describeError(status: number, statusText: string, data: unknown): string {
  const message =
    (data as any)?.error?.message ||
    (data as any)?.message ||
    (typeof data === 'string' && data.length < 200 ? data : '') ||
    statusText
  return `${status}: ${message}`
}

/**
 * Fetch the list of models available for the given provider configuration.
 * Tries a direct browser request first, then falls back to the server-side proxy
 * to work around providers that do not send CORS headers on GET /models.
 */
export async function fetchProviderModels(providerName: string, config: APIConfig): Promise<FetchModelsResult> {
  const provider = MODEL_PROVIDERS.find((p) => p.name === providerName)
  if (!provider) {
    throw new Error(`Unknown provider: ${providerName}`)
  }

  const endpoint = (config.endpoint || provider.endpoint || '').trim()
  if (!endpoint) {
    throw new Error('No endpoint configured')
  }

  const headers: Record<string, string> = {}
  let url: string

  if (provider.client === 'azure-openai') {
    url = buildAzureDeploymentsUrl(endpoint, config.azureApiVersion)
    if (config.apiKey?.trim()) {
      headers['api-key'] = config.apiKey.trim()
    }
  } else {
    url = deriveModelsUrl(endpoint)
    if (config.apiKey?.trim()) {
      headers['Authorization'] = `Bearer ${config.apiKey.trim()}`
    }
  }

  let status: number
  let statusText: string
  let data: unknown

  try {
    const response = await fetch(url, { method: 'GET', headers })
    status = response.status
    statusText = response.statusText
    data = await response.json().catch(() => null)
  } catch (directError) {
    // Network / CORS failure: retry through the Next.js proxy route
    try {
      const proxied = await requestViaProxy(url, headers)
      status = proxied.status
      statusText = proxied.statusText
      data = proxied.data
    } catch (proxyError) {
      const reason = proxyError instanceof Error ? proxyError.message : 'Connection failed'
      throw new Error(`Failed to reach ${url}: ${reason}`)
    }
  }

  if (status < 200 || status >= 300) {
    throw new Error(describeError(status, statusText, data))
  }

  const models = extractModelIds(data)
  if (models.length === 0) {
    throw new Error('The endpoint responded but no models were found in the response')
  }

  return { models, url }
}
