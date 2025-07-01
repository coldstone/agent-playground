'use client'

import React, { useState, useRef } from 'react'
import { APIConfig, Tool, Agent } from '@/types'
import { APIConfigPanel } from './api-config'
import { AgentsPanel } from './agents-panel'
import { ToolsPanel, ToolsPanelRef } from './tools-panel'
import { useSystemModel } from '@/hooks/use-system-model'
import { Settings, Wrench, ChevronDown, ChevronUp, Sparkles, Plus, Download, Upload, Bot } from 'lucide-react'


interface AccordionPanelProps {
  config: APIConfig
  agents: Agent[]
  tools: Tool[]
  onConfigChange: (config: APIConfig) => void
  onAgentCreate: () => void
  onAgentUpdate: (agentId: string, updates: Partial<Agent>) => void
  onAgentDelete: (agentId: string) => void
  onAgentReorder: (agents: Agent[]) => void
  onToolCreate: (tool: Tool) => void
  onToolUpdate: (tool: Tool) => void
  onToolDelete: (toolId: string) => void
  onExport: () => void
  onImport: () => void
}

type PanelType = 'agents' | 'tools' | 'llm' | 'export' | null

export function AccordionPanel({
  config,
  agents,
  tools,
  onConfigChange,
  onAgentCreate,
  onAgentUpdate,
  onAgentDelete,
  onAgentReorder,
  onToolCreate,
  onToolUpdate,
  onToolDelete,
  onExport,
  onImport
}: AccordionPanelProps) {
  // Determine initial panel based on current model configuration
  const getInitialPanel = (): PanelType => {
    if (typeof window !== 'undefined') {
      const currentModel = localStorage.getItem('agent-playground-current-model')
      return currentModel ? 'tools' : 'llm'
    }
    return 'llm'
  }

  const [activePanel, setActivePanel] = useState<PanelType>(getInitialPanel())
  const toolsPanelRef = useRef<ToolsPanelRef>(null)
  const { hasSystemModel } = useSystemModel()

  const togglePanel = (panel: PanelType) => {
    // 总是切换到点击的面板，实现互斥效果
    setActivePanel(panel)
  }

  return (
    <div className="w-80 min-w-80 bg-card border-l border-border flex flex-col h-full">
      {/* Agents Panel */}
      <div className={`border-b border-border ${activePanel === 'agents' ? 'flex-1 flex flex-col min-h-0' : ''}`}>
        <div
          onClick={() => togglePanel('agents')}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-muted/50 transition-colors cursor-pointer flex-shrink-0"
        >
          <div className="flex items-center gap-2">
            <Bot className="w-4 h-4" />
            <span className="text-sm font-semibold">Agents</span>
            <span className="text-sm text-muted-foreground">({agents.length})</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (activePanel !== 'agents') {
                  togglePanel('agents')
                }
                onAgentCreate()
              }}
              className="h-5 w-5 flex items-center justify-center hover:bg-muted rounded transition-colors"
              title="Create New Agent"
            >
              <Plus className="w-4 h-4" />
            </button>
            {activePanel === 'agents' ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </div>
        </div>
        {activePanel === 'agents' && (
          <div className="border-t border-border flex-1 min-h-0 overflow-hidden">
            <div className="h-full overflow-y-auto">
              <div className="p-4">
                <AgentsPanel
                  agents={agents}
                  tools={tools}
                  onAgentUpdate={onAgentUpdate}
                  onAgentDelete={onAgentDelete}
                  onAgentReorder={onAgentReorder}
                  onToolCreate={onToolCreate}
                  apiConfig={config}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tools Panel */}
      <div className={`border-b border-border ${activePanel === 'tools' ? 'flex-1 flex flex-col min-h-0' : ''}`}>
        <div
          onClick={() => togglePanel('tools')}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-muted/50 transition-colors cursor-pointer flex-shrink-0"
        >
          <div className="flex items-center gap-2">
            <Wrench className="w-4 h-4" />
            <span className="text-sm font-semibold">Tools</span>
            <span className="text-sm text-muted-foreground">({tools.length})</span>
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
              disabled={!hasSystemModel}
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
            <Settings className="w-4 h-4" />
            <span className="text-sm font-semibold">LLM Configuration</span>
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

      {/* Export & Import Panel */}
      <div className={`${activePanel === 'export' ? 'flex-1 flex flex-col min-h-0' : ''}`}>
        <div
          onClick={() => togglePanel('export')}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-muted/50 transition-colors cursor-pointer flex-shrink-0"
        >
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            <span className="text-sm font-semibold">Export & Import</span>
          </div>
          {activePanel === 'export' ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </div>

        {activePanel === 'export' && (
          <div className="border-t border-border flex-1 min-h-0 overflow-hidden">
            <div className="h-full overflow-y-auto">
              <div className="p-4 mt-5 flex flex-col items-center space-y-8">
                {/* Export Section */}
                <div className="w-full flex flex-col items-center">
                  <button
                    onClick={onExport}
                    className="w-full max-w-48 p-3 text-sm bg-gray-100 hover:bg-blue-500 hover:text-white rounded-lg flex items-center justify-center gap-2 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Export Data
                  </button>
                  <p className="text-sm text-muted-foreground mt-2 text-center">
                    Export all agents, tools to a JSON file
                  </p>
                </div>

                {/* Import Section */}
                <div className="w-full flex flex-col items-center">
                  <button
                    onClick={onImport}
                    className="w-full max-w-48 p-3 text-sm bg-gray-100 hover:bg-green-500 hover:text-white rounded-lg flex items-center justify-center gap-2 transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    Import Data
                  </button>
                  <p className="text-sm text-muted-foreground mt-2 text-center">
                    Import agents, tools from a JSON file
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
