'use client'

import React, { useState, useEffect } from 'react'
import { Agent, Tool } from '@/types'
import { X, Download, Bot, Wrench, Tag, Globe, Search } from 'lucide-react'

interface ExportModalProps {
  isOpen: boolean
  onClose: () => void
  agents: Agent[]
  tools: Tool[]
}

export function ExportModal({ isOpen, onClose, agents, tools }: ExportModalProps) {
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set())
  const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set())
  const [activeCategory, setActiveCategory] = useState<'agents' | 'tools' | string>('agents')
  const [agentSearchQuery, setAgentSearchQuery] = useState('')
  const [toolSearchQuery, setToolSearchQuery] = useState('')

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
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[80vh] flex flex-col">
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

        {/* Main Content - Left/Right Layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Sidebar - Categories */}
          <div className="w-64 border-r bg-gray-50 flex flex-col">
            <div className="p-4 flex-1 overflow-y-auto">
              <div className="space-y-1">
                <button
                  onClick={() => setActiveCategory('agents')}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition-colors flex items-center gap-2 ${
                    activeCategory === 'agents'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Bot className="w-4 h-4" />
                  Agents ({agents.length})
                </button>
                <button
                  onClick={() => setActiveCategory('tools')}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition-colors flex items-center gap-2 ${
                    activeCategory === 'tools'
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Wrench className="w-4 h-4" />
                  Tools ({tools.length})
                </button>
                
                {/* Tags as sub-items under Tools */}
                <div className="ml-6 space-y-1">
                  <button
                    onClick={() => setActiveCategory('untagged')}
                    className={`w-full text-left px-3 py-1.5 rounded text-xs transition-colors ${
                      activeCategory === 'untagged'
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    Untagged ({tools.filter(t => !t.tag).length})
                  </button>
                  {(() => {
                    const allTags = Array.from(new Set(
                      tools.map(t => t.tag).filter(Boolean)
                    )).sort()

                    return allTags.map(tag => {
                      const count = tools.filter(t => t.tag === tag).length
                      return (
                        <button
                          key={tag}
                          onClick={() => setActiveCategory(tag!)}
                          className={`w-full text-left px-3 py-1.5 rounded text-xs transition-colors flex items-center gap-1 ${
                            activeCategory === tag
                              ? 'bg-blue-100 text-blue-700'
                              : 'text-gray-500 hover:bg-gray-100'
                          }`}
                        >
                          <Tag className="w-2.5 h-2.5" />
                          <span className="truncate">{tag} ({count})</span>
                        </button>
                      )
                    })
                  })()}
                </div>
              </div>
            </div>
          </div>

          {/* Right Content Area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium flex items-center gap-2">
                  {activeCategory === 'agents' && (
                    <>
                      <Bot className="w-4 h-4" />
                      Select Agents
                    </>
                  )}
                  {(activeCategory === 'tools' || activeCategory === 'untagged' || (!['agents', 'tools'].includes(activeCategory))) && (
                    <>
                      <Wrench className="w-4 h-4" />
                      Select Tools
                      {activeCategory !== 'tools' && activeCategory !== 'untagged' && (
                        <span className="text-sm text-gray-500">- {activeCategory}</span>
                      )}
                    </>
                  )}
                </h3>
                
                {/* Search Box */}
                {activeCategory === 'agents' && (
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search agents..."
                      value={agentSearchQuery}
                      onChange={(e) => setAgentSearchQuery(e.target.value)}
                      className="pl-10 pr-4 py-2 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
                    />
                  </div>
                )}
                
                {(activeCategory === 'tools' || activeCategory === 'untagged' || (!['agents', 'tools'].includes(activeCategory))) && (
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search tools..."
                      value={toolSearchQuery}
                      onChange={(e) => setToolSearchQuery(e.target.value)}
                      className="pl-10 pr-4 py-2 border border-gray-200 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
                    />
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              {/* Agents Content */}
              {activeCategory === 'agents' && (
                <div className="space-y-3">
                  {(() => {
                    // Filter agents based on search query
                    const filteredAgents = agents.filter(agent => {
                      return agentSearchQuery === '' || 
                        agent.name.toLowerCase().includes(agentSearchQuery.toLowerCase()) ||
                        agent.description.toLowerCase().includes(agentSearchQuery.toLowerCase())
                    })
                    
                    return filteredAgents.map(agent => (
                      <label key={agent.id} className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded border cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedAgents.has(agent.id)}
                          onChange={() => handleAgentToggle(agent.id)}
                          className="rounded border-gray-300 mt-1"
                        />
                        <div className="flex-1">
                          <div className="font-medium">{agent.name}</div>
                          <div className="text-sm text-gray-500 mt-1">{agent.description}</div>
                          {agent.tools.length > 0 && (
                            <div className="text-xs text-blue-600 mt-2">
                              Uses {agent.tools.length} tool{agent.tools.length !== 1 ? 's' : ''}
                            </div>
                          )}
                        </div>
                      </label>
                    ))
                  })()}
                </div>
              )}

              {/* Tools Content */}
              {(activeCategory === 'tools' || activeCategory === 'untagged' || (!['agents', 'tools'].includes(activeCategory))) && (
                <div className="space-y-3">
                  {(() => {
                    // Filter tools based on active category and search query
                    let filteredTools = tools.filter(tool => {
                      // Filter by search query
                      const matchesSearch = toolSearchQuery === '' || 
                        tool.name.toLowerCase().includes(toolSearchQuery.toLowerCase()) ||
                        tool.description.toLowerCase().includes(toolSearchQuery.toLowerCase())
                      
                      if (!matchesSearch) return false
                      
                      // Filter by category
                      if (activeCategory === 'tools') return true
                      if (activeCategory === 'untagged') return !tool.tag
                      return tool.tag === activeCategory
                    })
                    
                    return filteredTools.map(tool => {
                      const isRequired = isToolRequired(tool.id)
                      return (
                        <label key={tool.id} className={`flex items-start gap-3 p-3 hover:bg-gray-50 rounded border ${isRequired ? 'cursor-not-allowed bg-orange-50' : 'cursor-pointer'}`}>
                          <input
                            type="checkbox"
                            checked={selectedTools.has(tool.id)}
                            onChange={() => handleToolToggle(tool.id)}
                            disabled={isRequired}
                            className="rounded border-gray-300 mt-1"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium">{tool.name}</span>
                              {tool.tag && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">
                                  <Tag className="w-2.5 h-2.5" />
                                  {tool.tag}
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-500 mt-1">{tool.description}</div>
                            {/* Tool URL */}
                            {tool.httpRequest?.url && (
                              <div className="mt-2 flex items-center gap-1 text-xs text-blue-600">
                                <Globe className="w-3 h-3" />
                                <span className="truncate" title={tool.httpRequest.url}>
                                  {tool.httpRequest.method} {tool.httpRequest.url}
                                </span>
                              </div>
                            )}
                            {isRequired && (
                              <div className="text-xs text-orange-600 mt-2 font-medium">
                                Required by selected agent(s)
                              </div>
                            )}
                          </div>
                        </label>
                      )
                    })
                  })()}
                </div>
              )}

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
