'use client'

import React from 'react'
import { Plug, BookOpen, Globe, Search } from 'lucide-react'

interface ToolCountBadgesProps {
  mcpToolCount?: number
  skillCount?: number
  webFetchEnabled?: boolean
  webSearchEnabled?: boolean
}

/**
 * Counts of the tools the model gets without the user selecting anything: MCP tools of enabled
 * servers, enabled skills and the built-in web fetch and web search. Shared by the chat input and the new-chat
 * overlay so both toolbars show the same badges in the same order. Renders nothing when there is
 * nothing to show.
 */
export function ToolCountBadges({
  mcpToolCount = 0,
  skillCount = 0,
  webFetchEnabled = false,
  webSearchEnabled = false
}: ToolCountBadgesProps) {
  if (mcpToolCount <= 0 && skillCount <= 0 && !webFetchEnabled && !webSearchEnabled) return null

  return (
    <>
      {mcpToolCount > 0 && (
        <span
          className="inline-flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400 whitespace-nowrap"
          title="Enabled MCP tools are available to the model in this conversation"
        >
          <Plug className="w-3.5 h-3.5" />
          {mcpToolCount} MCP tool{mcpToolCount > 1 ? 's' : ''}
        </span>
      )}
      {skillCount > 0 && (
        <span
          className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 whitespace-nowrap"
          title="Enabled skills are offered to the model in this conversation"
        >
          <BookOpen className="w-3.5 h-3.5" />
          {skillCount} skill{skillCount > 1 ? 's' : ''}
        </span>
      )}
      {webFetchEnabled && (
        <span
          className="inline-flex items-center gap-1 text-xs text-sky-600 dark:text-sky-400 whitespace-nowrap"
          title="The model can fetch and read public web pages in this conversation"
        >
          <Globe className="w-3.5 h-3.5" />
          Web fetch
        </span>
      )}
      {webSearchEnabled && (
        <span
          className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 whitespace-nowrap"
          title="The model can search the web through Tavily in this conversation"
        >
          <Search className="w-3.5 h-3.5" />
          Web search
        </span>
      )}
    </>
  )
}
