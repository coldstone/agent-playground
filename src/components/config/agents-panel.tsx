'use client'

import React, { useState } from 'react'
import { Agent, Tool } from '@/types'
import { AgentFormModal } from '@/components/agents/agent-form-modal'
import { AgentInstructionModal, AgentToolsModal } from '@/components/agents'
import { Trash2, Edit2, Bot, BookUser, Wrench as ToolIcon, GripVertical } from 'lucide-react'
import { formatTimestamp } from '@/lib/utils'

interface AgentsPanelProps {
  agents: Agent[]
  tools: Tool[]
  onAgentUpdate: (agentId: string, updates: Partial<Agent>) => void
  onAgentDelete: (agentId: string) => void
  onAgentReorder: (agents: Agent[]) => void
  apiConfig: any
}

export function AgentsPanel({
  agents,
  tools,
  onAgentUpdate,
  onAgentDelete,
  onAgentReorder,
  apiConfig
}: AgentsPanelProps) {
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [agentToDelete, setAgentToDelete] = useState<Agent | null>(null)
  const [showInstructionModal, setShowInstructionModal] = useState(false)
  const [showToolsModal, setShowToolsModal] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)

  // Drag state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  // Sort agents by order field
  const sortedAgents = [...agents].sort((a, b) => (a.order || 0) - (b.order || 0))

  const handleEdit = (agent: Agent) => {
    setEditingAgent(agent)
  }

  const handleDeleteClick = (agent: Agent) => {
    setAgentToDelete(agent)
    setShowDeleteConfirm(true)
  }

  const handleDeleteConfirm = () => {
    if (agentToDelete) {
      onAgentDelete(agentToDelete.id)
    }
    setShowDeleteConfirm(false)
    setAgentToDelete(null)
  }

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/html', '')
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverIndex(null)
    }
  }

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null)
      setDragOverIndex(null)
      return
    }

    const reorderedAgents = Array.from(sortedAgents)
    const [removed] = reorderedAgents.splice(draggedIndex, 1)
    reorderedAgents.splice(dropIndex, 0, removed)

    const updatedAgents = reorderedAgents.map((agent, index) => ({
      ...agent,
      order: index
    }))

    onAgentReorder(updatedAgents)
    
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const handleInstructionClick = (agent: Agent) => {
    setSelectedAgent(agent)
    setShowInstructionModal(true)
  }

  const handleToolsClick = (agent: Agent) => {
    setSelectedAgent(agent)
    setShowToolsModal(true)
  }

  const handleInstructionUpdate = (agentId: string, instruction: string) => {
    onAgentUpdate(agentId, { systemPrompt: instruction })
    setShowInstructionModal(false)
    setSelectedAgent(null)
  }

  const handleToolsUpdate = (agentId: string, toolIds: string[]) => {
    onAgentUpdate(agentId, { tools: toolIds })
    setShowToolsModal(false)
    setSelectedAgent(null)
  }

  return (
    <div>
      <div className="space-y-3">
        {agents.length === 0 ? (
          <div className="flex items-center justify-center text-center text-muted-foreground py-8">
            <div>
              <Bot className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No agents created yet</p>
              <p className="text-xs">Create agents to enable specialized functionality</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {sortedAgents.map((agent, index) => (
              <div
                key={agent.id}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
                onDragEnd={handleDragEnd}
                className={`group p-4 pl-1 rounded-lg border border-border hover:bg-muted/50 transition-colors ${
                  draggedIndex === index ? 'opacity-50 shadow-lg' : ''
                } ${
                  dragOverIndex === index ? 'border-blue-500 bg-blue-50' : ''
                }`}
              >
                <div className="flex gap-2">
                  <div className="flex items-center justify-center w-4 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing">
                    <GripVertical className="w-3 h-3 text-muted-foreground" />
                  </div>

                  <div className="flex-1 flex flex-col gap-2">
                    <div className="flex-1">
                      <h5 className="font-medium text-sm">{agent.name}</h5>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {agent.description}
                      </p>
                      {agent.tools && agent.tools.length > 0 && (
                        <div className="text-xs text-blue-600 mt-1">
                          Uses {agent.tools.length} tool{agent.tools.length !== 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-muted-foreground">
                        {formatTimestamp(agent.updatedAt)}
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleInstructionClick(agent)}
                          className="h-5 w-5 flex items-center justify-center hover:bg-muted rounded transition-colors"
                          title="Edit Instruction"
                        >
                          <BookUser className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleToolsClick(agent)}
                          className="h-5 w-5 flex items-center justify-center hover:bg-muted rounded transition-colors"
                          title="Manage Tools"
                        >
                          <ToolIcon className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleEdit(agent)}
                          className="h-5 w-5 flex items-center justify-center hover:bg-muted rounded transition-colors"
                          title="Edit Agent"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteClick(agent)}
                          className="h-5 w-5 flex items-center justify-center hover:bg-red-100 text-red-600 hover:text-red-700 rounded transition-colors"
                          title="Delete Agent"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Agent Modal */}
      <AgentFormModal
        isOpen={!!editingAgent}
        onClose={() => setEditingAgent(null)}
        agent={editingAgent}
        tools={tools}
        onAgentUpdate={onAgentUpdate}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-2">Delete Agent</h3>
            <p className="text-muted-foreground mb-4">
              Are you sure you want to delete "{agentToDelete?.name}"? This action cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm border border-border rounded hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Instruction Modal */}
      {showInstructionModal && selectedAgent && (
        <AgentInstructionModal
          isOpen={showInstructionModal}
          onClose={() => {
            setShowInstructionModal(false)
            setSelectedAgent(null)
          }}
          agent={selectedAgent}
          apiConfig={apiConfig}
          onSave={handleInstructionUpdate}
        />
      )}

      {/* Tools Modal */}
      {showToolsModal && selectedAgent && (
        <AgentToolsModal
          isOpen={showToolsModal}
          onClose={() => {
            setShowToolsModal(false)
            setSelectedAgent(null)
          }}
          agent={selectedAgent}
          allTools={tools}
          onSave={handleToolsUpdate}
        />
      )}
    </div>
  )
}
