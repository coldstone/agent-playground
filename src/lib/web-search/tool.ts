/**
 * The built-in web_search tool definition.
 *
 * Browser-safe: nothing from ./server may be imported here.
 */
import { Tool } from '@/types'
import { BuiltinToolSettings } from '../builtin-tools/settings'

export const WEB_SEARCH_TOOL_ID = 'builtin:web_search'
export const WEB_SEARCH_TOOL_NAME = 'web_search'

const DESCRIPTION =
  'Search the web and get a short list of results (title, URL, snippet) plus a brief answer. Use it ' +
  'to find current information, news, documentation or pages you do not have a URL for; then call ' +
  'web_fetch on a result URL when you need the full page. Each search costs the user one credit of ' +
  'their monthly quota, so make queries specific and avoid repeating them.'

/**
 * Build the web_search tool. Offered only when the group is enabled *and* a key is present -
 * without a key every call would come back as a 401 the model can do nothing about.
 */
export function buildWebSearchTools(settings: BuiltinToolSettings): Tool[] {
  if (!settings.webSearch.enabled) return []
  if (!settings.webSearch.apiKey.trim()) return []

  const now = Date.now()

  return [
    {
      id: WEB_SEARCH_TOOL_ID,
      name: WEB_SEARCH_TOOL_NAME,
      description: DESCRIPTION,
      schema: {
        type: 'function',
        function: {
          name: WEB_SEARCH_TOOL_NAME,
          description: DESCRIPTION,
          parameters: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'What to search for. Specific keywords work better than full sentences.'
              },
              max_results: {
                type: 'integer',
                description: 'Number of results to return, 1-10 (default 5).'
              },
              topic: {
                type: 'string',
                enum: ['general', 'news', 'finance'],
                description:
                  'general (default) for most searches; news for recent events (results carry a ' +
                  'published date); finance for market and company information.'
              },
              time_range: {
                type: 'string',
                enum: ['day', 'week', 'month', 'year'],
                description: 'Only return pages from this recent period. Omit for no time filter.'
              },
              search_depth: {
                type: 'string',
                enum: ['basic', 'advanced'],
                description:
                  'basic (default, 1 credit) is enough for most queries; advanced (2 credits) digs ' +
                  'deeper when basic results are poor.'
              },
              include_domains: {
                type: 'array',
                items: { type: 'string' },
                description: 'Restrict results to these domains, e.g. ["developer.mozilla.org"].'
              }
            },
            required: ['query']
          }
        }
      },
      builtin: { kind: 'web_search' },
      tag: 'Built-in',
      createdAt: now,
      updatedAt: now
    }
  ]
}

export function isWebSearchTool(tool: Tool | undefined | null): boolean {
  return !!tool && !!tool.builtin && tool.builtin.kind === 'web_search'
}
