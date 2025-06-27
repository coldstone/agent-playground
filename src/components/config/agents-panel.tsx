'use client'

import React, { useState } from 'react'
import { Agent, Tool } from '@/types'
import { AgentFormModal } from '@/components/agents/agent-form-modal'
import { Trash2, Edit2, Bot } from 'lucide-react'
import { formatTimestamp } from '@/lib/utils'

interface AgentsPanelProps {
  agents: Agent[]
  tools: Tool[]
  onAgentUpdate: (agentId: string, updates: Partial<Agent>) => void
  onAgentDelete: (agentId: string) => void
}

export function AgentsPanel({
  agents,
  tools,
  onAgentUpdate,
  onAgentDelete
}: AgentsPanelProps) {
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [agentToDelete, setAgentToDelete] = useState<Agent | null>(null)

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

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false)
    setAgentToDelete(null)
  }

  return (
    <>
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
            {agents.sort((a, b) => a.name.localeCompare(b.name)).map((agent) => (
              <div
                key={agent.id}
                className="group p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
              >
                <div className="flex flex-col gap-2">
                  <div className="flex-1">
                    <h5 className="font-medium text-sm">{agent.name}</h5>
                    <p className="text-xs text-muted-foreground mt-1">
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
          <div className="bg-background rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-4">Delete Agent</h3>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to delete "{agentToDelete?.name}"? This action cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={handleDeleteCancel}
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
    </>
  )
}
