'use client'

import React, { useState, useEffect } from 'react'
import { Agent, Tool } from '@/types'
import { X, Download, Bot, Wrench } from 'lucide-react'

interface ExportModalProps {
  isOpen: boolean
  onClose: () => void
  agents: Agent[]
  tools: Tool[]
}

export function ExportModal({ isOpen, onClose, agents, tools }: ExportModalProps) {
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set())
  const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set())

  // Reset selections when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedAgents(new Set())
      setSelectedTools(new Set())
    }
  }, [isOpen])

  // Auto-select tools when agents are selected
  useEffect(() => {
    const requiredTools = new Set<string>()
    selectedAgents.forEach(agentId => {
      const agent = agents.find(a => a.id === agentId)
      if (agent) {
        agent.tools.forEach(toolId => requiredTools.add(toolId))
      }
    })
    
    setSelectedTools(prev => {
      const newSelected = new Set(prev)
      requiredTools.forEach(toolId => newSelected.add(toolId))
      return newSelected
    })
  }, [selectedAgents, agents])

  const handleAgentToggle = (agentId: string) => {
    setSelectedAgents(prev => {
      const newSet = new Set(prev)
      if (newSet.has(agentId)) {
        newSet.delete(agentId)
      } else {
        newSet.add(agentId)
      }
      return newSet
    })
  }

  const handleToolToggle = (toolId: string) => {
    // Check if this tool is required by any selected agent
    const isRequired = Array.from(selectedAgents).some(agentId => {
      const agent = agents.find(a => a.id === agentId)
      return agent?.tools.includes(toolId)
    })

    if (isRequired) return // Don't allow deselecting required tools

    setSelectedTools(prev => {
      const newSet = new Set(prev)
      if (newSet.has(toolId)) {
        newSet.delete(toolId)
      } else {
        newSet.add(toolId)
      }
      return newSet
    })
  }

  const isToolRequired = (toolId: string) => {
    return Array.from(selectedAgents).some(agentId => {
      const agent = agents.find(a => a.id === agentId)
      return agent?.tools.includes(toolId)
    })
  }

  const handleExport = () => {
    // Process tools to only export header keys, not values
    const processedTools = tools
      .filter(tool => selectedTools.has(tool.id))
      .map(tool => {
        if (tool.httpRequest?.headers) {
          return {
            ...tool,
            httpRequest: {
              ...tool.httpRequest,
              headers: tool.httpRequest.headers.map(header => ({
                key: header.key,
                value: '' // Export empty value for security
              }))
            }
          }
        }
        return tool
      })

    const exportData = {
      agents: agents.filter(agent => selectedAgents.has(agent.id)),
      tools: processedTools
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    })
    
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `agent-playground-export-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Fixed Header */}
        <div className="flex items-center justify-between p-6 border-b flex-shrink-0">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Download className="w-5 h-5" />
            Export Agents & Tools
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Agents Section */}
            <div>
              <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
                <Bot className="w-4 h-4" />
                Agents ({agents.length})
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {agents.map(agent => (
                  <label key={agent.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedAgents.has(agent.id)}
                      onChange={() => handleAgentToggle(agent.id)}
                      className="rounded border-gray-300"
                    />
                    <div className="flex-1">
                      <div className="font-medium">{agent.name}</div>
                      <div className="text-sm text-gray-500">{agent.description}</div>
                      {agent.tools.length > 0 && (
                        <div className="text-xs text-blue-600 mt-1">
                          Uses {agent.tools.length} tool{agent.tools.length !== 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Tools Section */}
            <div>
              <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
                <Wrench className="w-4 h-4" />
                Tools ({tools.length})
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {tools.map(tool => {
                  const isRequired = isToolRequired(tool.id)
                  return (
                    <label key={tool.id} className={`flex items-center gap-3 p-2 hover:bg-gray-50 rounded ${isRequired ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                      <input
                        type="checkbox"
                        checked={selectedTools.has(tool.id)}
                        onChange={() => handleToolToggle(tool.id)}
                        disabled={isRequired}
                        className="rounded border-gray-300"
                      />
                      <div className="flex-1">
                        <div className="font-medium">{tool.name}</div>
                        <div className="text-sm text-gray-500">{tool.description}</div>
                        {isRequired && (
                          <div className="text-xs text-orange-600 mt-1">
                            Required by selected agent(s)
                          </div>
                        )}
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Fixed Footer */}
        <div className="flex items-center justify-between p-6 border-t bg-gray-50 flex-shrink-0">
          <div className="text-sm text-gray-600">
            Selected: {selectedAgents.size} agent{selectedAgents.size !== 1 ? 's' : ''}, {selectedTools.size} tool{selectedTools.size !== 1 ? 's' : ''}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleExport}
              disabled={selectedAgents.size === 0 && selectedTools.size === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
