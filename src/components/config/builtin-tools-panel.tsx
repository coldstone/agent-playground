'use client'

import React, { useState } from 'react'
import { Globe, BookOpen, Search, Eye, EyeOff } from 'lucide-react'
import { BuiltinToolSettings, normaliseWebSearch } from '@/lib/builtin-tools'

const TAVILY_SIGNUP_URL = 'https://app.tavily.com/home'

interface BuiltinToolsPanelProps {
  settings: BuiltinToolSettings
  onChange: (settings: BuiltinToolSettings) => void
  /** Number of skills enabled in the Skills panel, used to explain an idle skill group. */
  enabledSkillCount: number
}

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  disabled?: boolean
  title?: string
}

function Toggle({ checked, onChange, label, disabled = false, title }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={title}
      disabled={disabled}
      onClick={() => {
        if (!disabled) onChange(!checked)
      }}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors ${
        checked ? 'bg-primary' : 'bg-muted-foreground/30'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-[1.15rem]' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

const SKILL_TOOL_NAMES = ['load_skill', 'read_skill_file', 'list_skill_files', 'search_skill_files']

/**
 * The built-in tools the model can use without the user wiring anything up.
 *
 * The four skill tools are one switch, not four. They are a set: the model finds a skill's files
 * with list_skill_files and reads them with read_skill_file, so offering load_skill on its own
 * yields instructions it cannot act on.
 */
export function BuiltinToolsPanel({ settings, onChange, enabledSkillCount }: BuiltinToolsPanelProps) {
  const [showApiKey, setShowApiKey] = useState(false)
  const hasApiKey = settings.webSearch.apiKey.trim().length > 0

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
            <span className="text-sm font-medium">Skill tools</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Lets the model load enabled skills and read their bundled files.
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {SKILL_TOOL_NAMES.map(name => (
              <code
                key={name}
                className="px-1.5 py-0.5 rounded bg-muted text-[11px] text-muted-foreground"
              >
                {name}
              </code>
            ))}
          </div>
          {settings.skills.enabled && enabledSkillCount === 0 && (
            <p className="mt-2 text-xs text-muted-foreground/70">
              No skill enabled yet — enable one in the Skills panel and these tools are offered.
            </p>
          )}
        </div>
        <Toggle
          checked={settings.skills.enabled}
          label="Enable the built-in skill tools"
          onChange={(enabled) => onChange({ ...settings, skills: { ...settings.skills, enabled } })}
        />
      </div>

      <div className="flex items-start justify-between gap-3 border-t border-border pt-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-sky-600 dark:text-sky-400 flex-shrink-0" />
            <span className="text-sm font-medium">Web Fetch</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Lets the model read a URL: the page is fetched on the server and reduced to clean
            Markdown, so it can follow links the user pastes into the conversation.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Deployed on a public server? Start it with{' '}
            <code className="px-1 py-0.5 rounded bg-muted text-[11px]">WEB_FETCH_BLOCK_PRIVATE=true</code>{' '}
            to keep the model away from localhost and private networks.
          </p>
        </div>
        <Toggle
          checked={settings.webFetch.enabled}
          label="Enable the built-in web fetch tool"
          onChange={(enabled) => onChange({ ...settings, webFetch: { ...settings.webFetch, enabled } })}
        />
      </div>

      <div className="border-t border-border pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
              <span className="text-sm font-medium">Web Search</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Lets the model search the web through Tavily and follow up with Web Fetch.
            </p>
          </div>
          {/* Gated, not merely hinted: without a key the tool could only ever return 401s, so
              the switch cannot be turned on at all. */}
          <Toggle
            checked={settings.webSearch.enabled}
            label="Enable the built-in web search tool"
            disabled={!hasApiKey}
            title={hasApiKey ? undefined : 'Enter an API key first'}
            onChange={(enabled) =>
              onChange({
                ...settings,
                webSearch: normaliseWebSearch(enabled, settings.webSearch.apiKey)
              })
            }
          />
        </div>

        <div className="mt-2 relative">
          <input
            type={showApiKey ? 'text' : 'password'}
            value={settings.webSearch.apiKey}
            onChange={(event) =>
              // Clearing the key switches the tool off and persists that, so a stored
              // enabled-without-key state can never exist.
              onChange({
                ...settings,
                webSearch: normaliseWebSearch(settings.webSearch.enabled, event.target.value)
              })
            }
            placeholder="tvly-…"
            spellCheck={false}
            autoComplete="off"
            aria-label="Tavily API key"
            className="w-full pr-8 px-2 py-1.5 text-xs rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring font-mono"
          />
          <button
            type="button"
            onClick={() => setShowApiKey(!showApiKey)}
            aria-label={showApiKey ? 'Hide the API key' : 'Show the API key'}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>

        {!hasApiKey && (
          <p className="mt-1.5 text-xs text-muted-foreground/70">
            The switch stays off until a key is entered.
          </p>
        )}

        <p className="mt-2 text-xs text-muted-foreground">
          Get a free API key at{' '}
          <a
            href={TAVILY_SIGNUP_URL}
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-foreground"
          >
            app.tavily.com/home
          </a>{' '}
          — 1,000 credits per month, no card needed. A basic search costs 1 credit, an advanced one 2.
        </p>
      </div>
    </div>
  )
}
