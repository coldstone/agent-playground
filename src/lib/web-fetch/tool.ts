/**
 * The built-in web_fetch tool definition.
 *
 * Browser-safe: this module describes the tool to the model and must never pull in anything from
 * ./server, which needs Node APIs.
 */
import { Tool } from '@/types'
import { BuiltinToolSettings } from '../builtin-tools/settings'

export const WEB_FETCH_TOOL_ID = 'builtin:web_fetch'
export const WEB_FETCH_TOOL_NAME = 'web_fetch'

const DESCRIPTION =
  'Fetch a web page or file by URL and return its content as clean Markdown. HTML pages are reduced ' +
  'to their main content; JSON and plain text are returned as-is. Use it to read documentation, ' +
  'articles, README files, API responses and any public link the user gives you. Long pages come ' +
  'back in chunks: the result states the total length and the start_index to pass to get the next ' +
  'chunk. Pages that require a login cannot be read.'

/**
 * Build the web_fetch tool, or nothing when the user has not enabled it. Returning an array keeps
 * the call sites symmetrical with buildSkillTools / buildMCPTools.
 */
export function buildWebFetchTools(settings: BuiltinToolSettings): Tool[] {
  if (!settings.webFetch.enabled) return []

  const now = Date.now()

  return [
    {
      id: WEB_FETCH_TOOL_ID,
      name: WEB_FETCH_TOOL_NAME,
      description: DESCRIPTION,
      schema: {
        type: 'function',
        function: {
          name: WEB_FETCH_TOOL_NAME,
          description: DESCRIPTION,
          parameters: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'Absolute http(s) URL to fetch.'
              },
              mode: {
                type: 'string',
                enum: ['article', 'full', 'raw'],
                description:
                  'article (default): main content of the page only. full: the whole page including ' +
                  'navigation, lists and sidebars - use it when article mode misses what you need, ' +
                  'e.g. on index or listing pages. raw: no HTML conversion at all.'
              },
              max_length: {
                type: 'integer',
                description: 'Maximum number of characters to return (default 20000, max 100000).'
              },
              start_index: {
                type: 'integer',
                description:
                  'Return content starting at this character offset (default 0). Use the value ' +
                  'suggested by a truncated result to read the next chunk.'
              }
            },
            required: ['url']
          }
        }
      },
      builtin: { kind: 'web_fetch' },
      tag: 'Built-in',
      createdAt: now,
      updatedAt: now
    }
  ]
}

export function isWebFetchTool(tool: Tool | undefined | null): boolean {
  return !!tool && !!tool.builtin && tool.builtin.kind === 'web_fetch'
}
