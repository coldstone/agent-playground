/**
 * User settings for the built-in tools: skills, web fetch and web search.
 *
 * Kept in localStorage rather than IndexedDB: it is a single flag read on every render, and the
 * storage whitelist in indexeddb.ts stays untouched.
 *
 * Web fetch defaults to *disabled* on purpose. Enabling it would add a tool to every request for
 * every existing user, which changes how their agents behave without them asking. Skill tools
 * default to *enabled*, for the same reason in reverse: they already work that way today.
 *
 * The skill tools are governed as one group. A partial set is not useful - the model discovers a
 * skill's files through list_skill_files and reads them with read_skill_file, so offering
 * load_skill without them produces instructions the model cannot follow.
 *
 * The Tavily API key lives here with the rest of the settings, the same way LLM keys and MCP
 * headers do: in this browser's localStorage, sent to our own API route on each call and passed
 * straight through to Tavily. It is never persisted or logged server-side.
 */
export interface BuiltinToolSettings {
  skills: {
    enabled: boolean
  }
  webFetch: {
    enabled: boolean
  }
  webSearch: {
    enabled: boolean
    apiKey: string
  }
}

export const BUILTIN_TOOL_SETTINGS_KEY = 'agent-playground-builtin-tools'

export const DEFAULT_BUILTIN_TOOL_SETTINGS: BuiltinToolSettings = {
  skills: { enabled: true },
  webFetch: { enabled: false },
  webSearch: { enabled: false, apiKey: '' }
}

/**
 * Web search cannot be on without a key: the tool would be offered and every call would come back
 * as a 401 the model can do nothing about. The UI blocks that combination, and this normalises it
 * on the way in, so a hand-edited or older localStorage entry cannot produce it either.
 */
export function normaliseWebSearch(enabled: boolean, apiKey: string): BuiltinToolSettings['webSearch'] {
  const key = (apiKey || '').trim()
  return { enabled: enabled && key.length > 0, apiKey: key }
}

export function loadBuiltinToolSettings(): BuiltinToolSettings {
  if (typeof window === 'undefined') return DEFAULT_BUILTIN_TOOL_SETTINGS

  try {
    const stored = window.localStorage.getItem(BUILTIN_TOOL_SETTINGS_KEY)
    if (!stored) return DEFAULT_BUILTIN_TOOL_SETTINGS
    const parsed = JSON.parse(stored)
    return {
      webFetch: {
        enabled: !!(parsed && parsed.webFetch && parsed.webFetch.enabled),
      },
      // Absent in objects stored before skill tools became switchable: fall back to the default
      // rather than to false, so an existing user does not silently lose their skills.
      skills: {
        enabled:
          parsed && parsed.skills && typeof parsed.skills.enabled === 'boolean'
            ? parsed.skills.enabled
            : DEFAULT_BUILTIN_TOOL_SETTINGS.skills.enabled
      },
      webSearch: normaliseWebSearch(
        !!(parsed && parsed.webSearch && parsed.webSearch.enabled),
        parsed && parsed.webSearch && typeof parsed.webSearch.apiKey === 'string'
          ? parsed.webSearch.apiKey
          : ''
      )
    }
  } catch {
    return DEFAULT_BUILTIN_TOOL_SETTINGS
  }
}

export function saveBuiltinToolSettings(settings: BuiltinToolSettings): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(BUILTIN_TOOL_SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // Storage full or blocked; the setting simply does not persist.
  }
}
