'use client'

import React, { useState, useEffect } from 'react'
import { Agent, Tool } from '@/types'
import { X, Upload, Bot, Wrench, AlertTriangle } from 'lucide-react'
import { useToast } from '@/components/ui/toast'

interface ImportData {
  agents: Agent[]
  tools: Tool[]
}

interface ImportModalProps {
  isOpen: boolean
  onClose: () => void
  onImport: (agents: Agent[], tools: Tool[]) => void
  existingAgents: Agent[]
  existingTools: Tool[]
}

// Helper function to merge headers, preserving existing values
const mergeHeaders = (existingHeaders: { key: string; value: string }[], importHeaders: { key: string; value: string }[]) => {
  const existingHeaderMap = new Map(existingHeaders.map(h => [h.key, h.value]))

  // Start with import headers structure
  const mergedHeaders = importHeaders.map(importHeader => ({
    key: importHeader.key,
    value: existingHeaderMap.get(importHeader.key) || importHeader.value // Use existing value if available
  }))

  return mergedHeaders
}

export function ImportModal({ isOpen, onClose, onImport, existingAgents, existingTools }: ImportModalProps) {
  const { showToast, ToastContainer } = useToast()
  const [importData, setImportData] = useState<ImportData | null>(null)
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set())
  const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set())

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setImportData(null)
      setSelectedAgents(new Set())
      setSelectedTools(new Set())
    }
  }, [isOpen])

  // Auto-select all items when import data is loaded
  useEffect(() => {
    if (importData) {
      setSelectedAgents(new Set(importData.agents.map(a => a.id)))
      setSelectedTools(new Set(importData.tools.map(t => t.id)))
    }
  }, [importData])

  // Auto-select tools when agents are selected
  useEffect(() => {
    if (!importData) return
    
    const requiredTools = new Set<string>()
    selectedAgents.forEach(agentId => {
      const agent = importData.agents.find(a => a.id === agentId)
      if (agent) {
        agent.tools.forEach(toolId => requiredTools.add(toolId))
      }
    })
    
    setSelectedTools(prev => {
      const newSelected = new Set(prev)
      requiredTools.forEach(toolId => newSelected.add(toolId))
      return newSelected
    })
  }, [selectedAgents, importData])

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string
        const data = JSON.parse(content) as ImportData
        
        // Validate the data structure
        if (!data.agents || !data.tools || !Array.isArray(data.agents) || !Array.isArray(data.tools)) {
          showToast('Invalid file format. Expected agents and tools arrays.', 'error')
          return
        }

        setImportData(data)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to parse file'
        showToast(errorMessage, 'error')
        setImportData(null)
      }
    }
    reader.readAsText(file)
  }

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
    if (!importData) return
    
    // Check if this tool is required by any selected agent
    const isRequired = Array.from(selectedAgents).some(agentId => {
      const agent = importData.agents.find(a => a.id === agentId)
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
    if (!importData) return false
    return Array.from(selectedAgents).some(agentId => {
      const agent = importData.agents.find(a => a.id === agentId)
      return agent?.tools.includes(toolId)
    })
  }

  const isAgentConflict = (agentId: string) => {
    return existingAgents.some(a => a.id === agentId)
  }

  const isToolConflict = (toolId: string) => {
    return existingTools.some(t => t.id === toolId)
  }

  const handleImport = () => {
    if (!importData) return

    const agentsToImport = importData.agents.filter(agent => selectedAgents.has(agent.id))

    // Process tools to merge headers with existing values
    const toolsToImport = importData.tools
      .filter(tool => selectedTools.has(tool.id))
      .map(importTool => {
        const existingTool = existingTools.find(t => t.id === importTool.id)

        if (existingTool?.httpRequest?.headers && importTool.httpRequest?.headers) {
          return {
            ...importTool,
            httpRequest: {
              ...importTool.httpRequest,
              headers: mergeHeaders(existingTool.httpRequest.headers, importTool.httpRequest.headers)
            }
          }
        }

        return importTool
      })

    onImport(agentsToImport, toolsToImport)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Import Agents & Tools
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {!importData ? (
            <div className="text-center py-8">
              <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Select a file to import</h3>
              <p className="text-gray-600 mb-4">Choose a JSON file containing agents and tools</p>
              <label className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer transition-colors">
                <Upload className="w-4 h-4" />
                Choose File
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Agents Section */}
              <div>
                <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
                  <Bot className="w-4 h-4" />
                  Agents ({importData.agents.length})
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {importData.agents.map(agent => {
                    const hasConflict = isAgentConflict(agent.id)
                    return (
                      <label key={agent.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedAgents.has(agent.id)}
                          onChange={() => handleAgentToggle(agent.id)}
                          className="rounded border-gray-300"
                        />
                        <div className="flex-1">
                          <div className="font-medium flex items-center gap-2">
                            {agent.name}
                            {hasConflict && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded">
                                <AlertTriangle className="w-3 h-3" />
                                Will overwrite
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-500">{agent.description}</div>
                          {agent.tools.length > 0 && (
                            <div className="text-xs text-blue-600 mt-1">
                              Uses {agent.tools.length} tool{agent.tools.length !== 1 ? 's' : ''}
                            </div>
                          )}
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Tools Section */}
              <div>
                <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
                  <Wrench className="w-4 h-4" />
                  Tools ({importData.tools.length})
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {importData.tools.map(tool => {
                    const isRequired = isToolRequired(tool.id)
                    const hasConflict = isToolConflict(tool.id)
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
                          <div className="font-medium flex items-center gap-2">
                            {tool.name}
                            {hasConflict && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded">
                                <AlertTriangle className="w-3 h-3" />
                                Will overwrite
                              </span>
                            )}
                          </div>
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
          )}
        </div>

        {importData && (
          <div className="flex items-center justify-between p-6 border-t bg-gray-50">
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
                onClick={handleImport}
                disabled={selectedAgents.size === 0 && selectedTools.size === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Import
              </button>
            </div>
          </div>
        )}
      </div>
      <ToastContainer />
    </div>
  )
}
