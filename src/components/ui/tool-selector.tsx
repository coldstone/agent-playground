'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Tool } from '@/types'
import { ChevronDown } from 'lucide-react'

interface ToolSelectorProps {
  tools: Tool[]
  selectedToolIds: string[]
  onToolsChange: (toolIds: string[]) => void
}

export function ToolSelector({ tools, selectedToolIds, onToolsChange }: ToolSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleToolToggle = (toolId: string) => {
    const newSelectedToolIds = selectedToolIds.includes(toolId)
      ? selectedToolIds.filter(id => id !== toolId)
      : [...selectedToolIds, toolId]
    onToolsChange(newSelectedToolIds)
  }

  const handleClearSelection = () => {
    onToolsChange([])
    setIsOpen(false)
  }

  const getDisplayText = () => {
    if (selectedToolIds.length === 0) {
      return 'Select Tools'
    } else if (selectedToolIds.length === 1) {
      return '1 tool selected'
    } else {
      return `${selectedToolIds.length} tools selected`
    }
  }

  // Group tools by tag and sort within each group
  const groupedTools = tools.reduce((groups, tool) => {
    const category = tool.tag || 'Other'
    if (!groups[category]) {
      groups[category] = []
    }
    groups[category].push(tool)
    return groups
  }, {} as Record<string, Tool[]>)

  // Sort tools within each group by name
  Object.keys(groupedTools).forEach(category => {
    groupedTools[category].sort((a, b) => a.name.localeCompare(b.name))
  })

  if (tools.length === 0) {
    return null
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 border border-border bg-muted hover:bg-muted/80 transition-colors min-w-[120px] rounded-full"
      >
        <span className="flex-1 text-left truncate text-xs text-muted-foreground">{getDisplayText()}</span>
        <ChevronDown className="w-3 h-3 text-muted-foreground" />
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 mb-1 w-64 bg-card border border-border rounded-md shadow-lg z-50 max-h-64 overflow-y-auto">
          {tools.length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground text-center">
              No tools available
            </div>
          ) : (
            <div className="p-0">
              {/* Clear selection option */}
              {selectedToolIds.length > 0 && (
                <>
                  <div
                    className="p-2 hover:bg-muted/50 rounded cursor-pointer text-sm text-muted-foreground"
                    onClick={handleClearSelection}
                  >
                    Clear selection
                  </div>
                </>
              )}

              {/* Grouped tools */}
              {Object.entries(groupedTools)
                .sort(([a], [b]) => {
                  if (a === 'Other') return 1;
                  if (b === 'Other') return -1;
                  return a.localeCompare(b);
                })
                .map(([category, categoryTools]) => (
                  <div key={category}>
                    <div className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted/50 border-b border-border">
                      {category}
                    </div>
                    {categoryTools.map((tool) => (
                      <div
                        key={tool.id}
                        className="flex items-center gap-2 p-2 hover:bg-muted/50 rounded cursor-pointer"
                        onClick={() => handleToolToggle(tool.id)}
                      >
                        <input
                          type="checkbox"
                          checked={selectedToolIds.includes(tool.id)}
                          onChange={() => {}} // Handled by parent div click
                          className="apg-checkbox flex-shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm truncate">{tool.name}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
