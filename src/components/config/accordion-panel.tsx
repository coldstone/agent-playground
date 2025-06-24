'use client'

import React, { useState, useRef } from 'react'
import { APIConfig, Tool } from '@/types'
import { APIConfigPanel } from './api-config'
import { ToolsPanel, ToolsPanelRef } from './tools-panel'
import { Settings, Wrench, ChevronDown, ChevronUp, Sparkles, Plus } from 'lucide-react'


interface AccordionPanelProps {
  config: APIConfig
  tools: Tool[]
  onConfigChange: (config: APIConfig) => void
  onToolCreate: (tool: Tool) => void
  onToolUpdate: (tool: Tool) => void
  onToolDelete: (toolId: string) => void
}

type PanelType = 'tools' | 'llm' | null

export function AccordionPanel({
  config,
  tools,
  onConfigChange,
  onToolCreate,
  onToolUpdate,
  onToolDelete
}: AccordionPanelProps) {
  const [activePanel, setActivePanel] = useState<PanelType>('llm')
  const toolsPanelRef = useRef<ToolsPanelRef>(null)

  const togglePanel = (panel: PanelType) => {
    // 总是切换到点击的面板，实现互斥效果
    setActivePanel(panel)
  }

  return (
    <div className="w-80 min-w-80 bg-card border-l border-border flex flex-col h-full">
      {/* Tools Panel */}
      <div className={`border-b border-border ${activePanel === 'tools' ? 'flex-1 flex flex-col min-h-0' : ''}`}>
        <div
          onClick={() => togglePanel('tools')}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-muted/50 transition-colors cursor-pointer flex-shrink-0"
        >
          <div className="flex items-center gap-2">
            <Wrench className="w-5 h-5" />
            <span className="text-base font-semibold">Tools</span>
            <span className="text-base text-muted-foreground">({tools.length})</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (activePanel !== 'tools') {
                  togglePanel('tools')
                }
                setTimeout(() => {
                  toolsPanelRef.current?.openCreateModal()
                }, 0)
              }}
              className="h-5 w-5 flex items-center justify-center hover:bg-muted rounded transition-colors"
              title="Create Custom Tool"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (activePanel !== 'tools') {
                  togglePanel('tools')
                }
                setTimeout(() => {
                  toolsPanelRef.current?.openGeneratorModal()
                }, 0)
              }}
              className="h-5 w-5 flex items-center justify-center bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded disabled:opacity-50 transition-colors"
              disabled={!config?.apiKey || !config?.endpoint}
              title="AI Generate Tool"
            >
              <Sparkles className="w-3 h-3" />
            </button>
            {activePanel === 'tools' ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </div>
        </div>

        {activePanel === 'tools' && (
          <div className="border-t border-border flex-1 min-h-0 overflow-hidden">
            <div className="h-full overflow-y-auto">
              <div className="p-4">
                <ToolsPanel
                  ref={toolsPanelRef}
                  tools={tools}
                  config={config}
                  onToolCreate={onToolCreate}
                  onToolUpdate={onToolUpdate}
                  onToolDelete={onToolDelete}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* LLM Configuration Panel */}
      <div className={`border-b border-border ${activePanel === 'llm' ? 'flex-1 flex flex-col min-h-0' : ''}`}>
        <div
          onClick={() => togglePanel('llm')}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-muted/50 transition-colors cursor-pointer flex-shrink-0"
        >
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            <span className="text-base font-semibold">LLM Configuration</span>
          </div>
          {activePanel === 'llm' ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </div>

        {activePanel === 'llm' && (
          <div className="border-t border-border flex-1 min-h-0 overflow-hidden">
            <div className="h-full overflow-y-auto">
              <div className="p-4">
                <APIConfigPanel
                  config={config}
                  onConfigChange={onConfigChange}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
