'use client'

import React, { useState, useEffect } from 'react'
import { Agent, Tool } from '@/types'
import { X, Wrench, Save, Check } from 'lucide-react'

interface AgentToolsModalProps {
  isOpen: boolean
  onClose: () => void
  agent: Agent | null
  allTools: Tool[]
  onSave: (agentId: string, toolIds: string[]) => void
}

export function AgentToolsModal({ isOpen, onClose, agent, allTools, onSave }: AgentToolsModalProps) {
  const [selectedToolIds, setSelectedToolIds] = useState<Set<string>>(new Set())
  const [initialSelectedToolIds, setInitialSelectedToolIds] = useState<Set<string>>(new Set())
  const [isSaving, setIsSaving] = useState(false)

  // Reset selected tools when modal opens or agent changes
  useEffect(() => {
    if (isOpen && agent) {
      const initialTools = new Set(agent.tools)
      setSelectedToolIds(initialTools)
      setInitialSelectedToolIds(initialTools)
    }
  }, [isOpen, agent])

  const handleToolToggle = (toolId: string) => {
    setSelectedToolIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(toolId)) {
        newSet.delete(toolId)
      } else {
        newSet.add(toolId)
      }
      return newSet
    })
  }

  const handleSave = async () => {
    if (!agent) return
    
    setIsSaving(true)
    try {
      await onSave(agent.id, Array.from(selectedToolIds))
      onClose()
    } catch (error) {
      console.error('Failed to save tools:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setSelectedToolIds(new Set(agent?.tools || []))
    onClose()
  }

  if (!isOpen || !agent) return null

  const selectedCount = selectedToolIds.size

  // 排序逻辑：已保存的工具在顶部，其他工具按名称排序
  const sortedTools = [...allTools].sort((a, b) => {
    const aWasInitiallySelected = initialSelectedToolIds.has(a.id)
    const bWasInitiallySelected = initialSelectedToolIds.has(b.id)

    // 如果一个是初始选中的，另一个不是，初始选中的排在前面
    if (aWasInitiallySelected && !bWasInitiallySelected) return -1
    if (!aWasInitiallySelected && bWasInitiallySelected) return 1

    // 如果都是初始选中的，或者都不是初始选中的，按名称排序
    return a.name.localeCompare(b.name)
  })

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Wrench className="w-5 h-5" />
            Manage Tools - {agent.name}
          </h2>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600 mb-4">
                Select the tools that this agent can use. Tools provide additional capabilities like API calls, data processing, and external integrations.
              </p>
            </div>

            {allTools.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Wrench className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No tools available</p>
                <p className="text-sm">Create tools first to assign them to agents</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sortedTools.map(tool => (
                  <label
                    key={tool.id}
                    className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center h-5">
                      <input
                        type="checkbox"
                        checked={selectedToolIds.has(tool.id)}
                        onChange={() => handleToolToggle(tool.id)}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900">{tool.name}</h3>
                        {selectedToolIds.has(tool.id) && (
                          <Check className="w-4 h-4 text-green-600" />
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{tool.description}</p>
                      {tool.httpRequest && (
                        <div className="text-xs text-blue-600 mt-1">
                          HTTP: {tool.httpRequest.method} {tool.httpRequest.url}
                        </div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between p-6 border-t bg-gray-50">
          <div className="text-sm text-gray-600">
            Selected: {selectedCount} tool{selectedCount !== 1 ? 's' : ''}
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
