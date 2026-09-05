'use client'

import React from 'react'
import { Plug, BookOpen } from 'lucide-react'

interface ToolCountBadgesProps {
  mcpToolCount?: number
  skillCount?: number
}

/**
 * Counts of the tools the model gets without the user selecting anything: MCP tools of enabled
 * servers and enabled skills. Shared by the chat input and the new-chat overlay so both
 * toolbars show the same badges in the same order. Renders nothing when both counts are 0.
 */
export function ToolCountBadges({ mcpToolCount = 0, skillCount = 0 }: ToolCountBadgesProps) {
  if (mcpToolCount <= 0 && skillCount <= 0) return null

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
    </>
  )
}
