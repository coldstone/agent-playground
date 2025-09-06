'use client'

import React, { useState, useEffect } from 'react'
import { Agent, Tool, ChatSession } from '@/types'
import { X, Trash2, Bot, Wrench, MessageSquare, AlertTriangle, Check, Square, Tag } from 'lucide-react'

interface BatchDeleteModalProps {
  isOpen: boolean
  onClose: () => void
  agents: Agent[]
  tools: Tool[]
  sessions: ChatSession[]
  onDelete: (selectedAgents: string[], selectedTools: string[], selectedSessions: string[]) => void
}

export function BatchDeleteModal({ 
  isOpen, 
  onClose, 
  agents, 
  tools, 
  sessions, 
  onDelete 
}: BatchDeleteModalProps) {
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set())
  const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set())
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set())
  const [activeCategory, setActiveCategory] = useState<'agents' | 'tools' | 'conversations' | string>('agents')

  // Reset selections when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedAgents(new Set())
      setSelectedTools(new Set())
      setSelectedSessions(new Set())
      setActiveCategory('agents')
    }
  }, [isOpen])

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

  const handleSessionToggle = (sessionId: string) => {
    setSelectedSessions(prev => {
      const newSet = new Set(prev)
      if (newSet.has(sessionId)) {
        newSet.delete(sessionId)
      } else {
        newSet.add(sessionId)
      }
      return newSet
    })
  }

  const handleSelectAllAgents = () => {
    if (selectedAgents.size === agents.length) {
      setSelectedAgents(new Set())
    } else {
      setSelectedAgents(new Set(agents.map(a => a.id)))
    }
  }

  const handleSelectAllTools = () => {
    if (selectedTools.size === tools.length) {
      setSelectedTools(new Set())
    } else {
      setSelectedTools(new Set(tools.map(t => t.id)))
    }
  }

  const handleSelectAllSessions = () => {
    if (selectedSessions.size === sessions.length) {
      setSelectedSessions(new Set())
    } else {
      setSelectedSessions(new Set(sessions.map(s => s.id)))
    }
  }

  const handleDelete = () => {
    onDelete(Array.from(selectedAgents), Array.from(selectedTools), Array.from(selectedSessions))
    onClose()
  }

  const totalSelected = selectedAgents.size + selectedTools.size + selectedSessions.size

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[80vh] flex flex-col">
        {/* Fixed Header */}
        <div className="flex items-center justify-between p-6 border-b flex-shrink-0">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-red-500" />
            Batch Delete
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Warning Notice */}
        <div className="px-6 py-4 bg-red-50 border-b">
          <div className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm font-medium">
              Warning: This action cannot be undone. Please select items carefully.
            </span>
          </div>
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
                      ? 'bg-red-100 text-red-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Bot className="w-4 h-4" />
                  Agents ({agents.length})
                  {selectedAgents.size > 0 && (
                    <span className="ml-auto text-xs bg-red-200 text-red-800 px-1.5 py-0.5 rounded-full">
                      {selectedAgents.size}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveCategory('tools')}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition-colors flex items-center gap-2 ${
                    activeCategory === 'tools'
                      ? 'bg-red-100 text-red-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Wrench className="w-4 h-4" />
                  Tools ({tools.length})
                  {selectedTools.size > 0 && (
                    <span className="ml-auto text-xs bg-red-200 text-red-800 px-1.5 py-0.5 rounded-full">
                      {selectedTools.size}
                    </span>
                  )}
                </button>
                
                {/* Tags as sub-items under Tools */}
                <div className="ml-6 space-y-1">
                  <button
                    onClick={() => setActiveCategory('untagged')}
                    className={`w-full text-left px-3 py-1.5 rounded text-xs transition-colors ${
                      activeCategory === 'untagged'
                        ? 'bg-red-100 text-red-700'
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
                              ? 'bg-red-100 text-red-700'
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
                <button
                  onClick={() => setActiveCategory('conversations')}
                  className={`w-full text-left px-3 py-2 rounded text-sm transition-colors flex items-center gap-2 ${
                    activeCategory === 'conversations'
                      ? 'bg-red-100 text-red-700'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <MessageSquare className="w-4 h-4" />
                  Conversations ({sessions.length})
                  {selectedSessions.size > 0 && (
                    <span className="ml-auto text-xs bg-red-200 text-red-800 px-1.5 py-0.5 rounded-full">
                      {selectedSessions.size}
                    </span>
                  )}
                </button>
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
                      Select Agents to Delete
                    </>
                  )}
                  {(activeCategory === 'tools' || activeCategory === 'untagged' || (!['agents', 'tools', 'conversations'].includes(activeCategory))) && (
                    <>
                      <Wrench className="w-4 h-4" />
                      Select Tools to Delete
                      {activeCategory !== 'tools' && activeCategory !== 'untagged' && (
                        <span className="text-sm text-gray-500">- {activeCategory}</span>
                      )}
                    </>
                  )}
                  {activeCategory === 'conversations' && (
                    <>
                      <MessageSquare className="w-4 h-4" />
                      Select Conversations to Delete
                    </>
                  )}
                </h3>
                
                {/* Select All Button */}
                <button
                  onClick={() => {
                    if (activeCategory === 'agents') {
                      handleSelectAllAgents()
                    } else if (activeCategory === 'conversations') {
                      handleSelectAllSessions()
                    } else {
                      // For tools categories
                      const filteredTools = tools.filter(tool => {
                        if (activeCategory === 'tools') return true
                        if (activeCategory === 'untagged') return !tool.tag
                        return tool.tag === activeCategory
                      })
                      
                      const allFilteredSelected = filteredTools.every(tool => selectedTools.has(tool.id))
                      if (allFilteredSelected) {
                        // Deselect all filtered tools
                        const newSelected = new Set(selectedTools)
                        filteredTools.forEach(tool => newSelected.delete(tool.id))
                        setSelectedTools(newSelected)
                      } else {
                        // Select all filtered tools
                        const newSelected = new Set(selectedTools)
                        filteredTools.forEach(tool => newSelected.add(tool.id))
                        setSelectedTools(newSelected)
                      }
                    }
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded transition-colors"
                >
                  {(() => {
                    let allSelected = false
                    if (activeCategory === 'agents') {
                      allSelected = selectedAgents.size === agents.length && agents.length > 0
                    } else if (activeCategory === 'conversations') {
                      allSelected = selectedSessions.size === sessions.length && sessions.length > 0
                    } else {
                      // For tools categories
                      const filteredTools = tools.filter(tool => {
                        if (activeCategory === 'tools') return true
                        if (activeCategory === 'untagged') return !tool.tag
                        return tool.tag === activeCategory
                      })
                      allSelected = filteredTools.length > 0 && filteredTools.every(tool => selectedTools.has(tool.id))
                    }
                    
                    return allSelected ? <Check className="w-4 h-4" /> : <Square className="w-4 h-4" />
                  })()}
                  Select All
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6">
              {/* Agents Content */}
              {activeCategory === 'agents' && (
                <div className="space-y-3">
                  {agents.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-8">No agents to delete</p>
                  ) : (
                    agents.map(agent => (
                      <label key={agent.id} className="flex items-start gap-3 p-3 hover:bg-red-50 rounded border cursor-pointer">
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
                  )}
                </div>
              )}

              {/* Tools Content */}
              {(activeCategory === 'tools' || activeCategory === 'untagged' || (!['agents', 'tools', 'conversations'].includes(activeCategory))) && (
                <div className="space-y-3">
                  {(() => {
                    // Filter tools based on active category
                    const filteredTools = tools.filter(tool => {
                      if (activeCategory === 'tools') return true
                      if (activeCategory === 'untagged') return !tool.tag
                      return tool.tag === activeCategory
                    })

                    if (filteredTools.length === 0) {
                      return <p className="text-sm text-gray-500 text-center py-8">No tools to delete</p>
                    }

                    return filteredTools.map(tool => (
                      <label key={tool.id} className="flex items-start gap-3 p-3 hover:bg-red-50 rounded border cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedTools.has(tool.id)}
                          onChange={() => handleToolToggle(tool.id)}
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
                          {tool.httpRequest?.url && (
                            <div className="text-xs text-blue-600 mt-2">
                              {tool.httpRequest.method} {tool.httpRequest.url}
                            </div>
                          )}
                        </div>
                      </label>
                    ))
                  })()}
                </div>
              )}

              {/* Conversations Content */}
              {activeCategory === 'conversations' && (
                <div className="space-y-3">
                  {sessions.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-8">No conversations to delete</p>
                  ) : (
                    sessions.map(session => (
                      <label key={session.id} className="flex items-start gap-3 p-3 hover:bg-red-50 rounded border cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedSessions.has(session.id)}
                          onChange={() => handleSessionToggle(session.id)}
                          className="rounded border-gray-300 mt-1"
                        />
                        <div className="flex-1">
                          <div className="font-medium">{session.name || 'Untitled Conversation'}</div>
                          <div className="text-sm text-gray-500 mt-1">
                            {session.messages.length} message{session.messages.length !== 1 ? 's' : ''}
                            {session.createdAt && (
                              <span className="ml-2">
                                • {new Date(session.createdAt).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </div>
                      </label>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Fixed Footer */}
        <div className="flex items-center justify-between p-6 border-t bg-gray-50 flex-shrink-0">
          <div className="text-sm text-gray-600">
            Selected: {totalSelected} item{totalSelected !== 1 ? 's' : ''} 
            ({selectedAgents.size} agent{selectedAgents.size !== 1 ? 's' : ''}, {selectedTools.size} tool{selectedTools.size !== 1 ? 's' : ''}, {selectedSessions.size} conversation{selectedSessions.size !== 1 ? 's' : ''})
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={totalSelected === 0}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete Selected ({totalSelected})
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}