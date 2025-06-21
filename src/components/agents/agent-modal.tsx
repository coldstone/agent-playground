'use client'

import React, { useState, useEffect } from 'react'
import { Agent, Tool } from '@/types'
import { Modal, ModalBody, ModalFooter } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { generateId, formatTimestamp } from '@/lib/utils'
import { Bot, Plus, Edit2, Trash2, Wrench as ToolIcon } from 'lucide-react'

interface AgentModalProps {
  isOpen: boolean
  onClose: () => void
  agents: Agent[]
  tools: Tool[]
  onAgentCreate: (agent: Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>) => void
  onAgentUpdate: (agentId: string, agent: Partial<Agent>) => void
  onAgentDelete: (agentId: string) => void
}

export function AgentModal({
  isOpen,
  onClose,
  agents,
  tools,
  onAgentCreate,
  onAgentUpdate,
  onAgentDelete
}: AgentModalProps) {
  const [view, setView] = useState<'list' | 'create' | 'edit'>('list')
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    systemPrompt: '',
    selectedTools: [] as string[]
  })

  useEffect(() => {
    if (!isOpen) {
      setView('list')
      setEditingAgent(null)
      resetForm()
    }
  }, [isOpen])

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      systemPrompt: 'You are a helpful AI assistant with access to tools. When you need to use a tool, call the appropriate function with the required parameters.',
      selectedTools: []
    })
  }

  const handleCreate = () => {
    setView('create')
    resetForm()
  }

  const handleEdit = (agent: Agent) => {
    setEditingAgent(agent)
    setFormData({
      name: agent.name,
      description: agent.description,
      systemPrompt: agent.systemPrompt,
      selectedTools: agent.tools // agent.tools is now string[] of tool IDs
    })
    setView('edit')
  }

  const handleSave = () => {
    if (!formData.name.trim()) return

    const agentData = {
      name: formData.name,
      description: formData.description,
      systemPrompt: formData.systemPrompt,
      tools: formData.selectedTools // Store tool IDs directly
    }

    if (view === 'create') {
      onAgentCreate(agentData)
    } else if (view === 'edit' && editingAgent) {
      onAgentUpdate(editingAgent.id, agentData)
    }

    setView('list')
    resetForm()
  }

  const handleCancel = () => {
    setView('list')
    resetForm()
  }

  const handleDelete = (agentId: string) => {
    if (confirm('Are you sure you want to delete this agent?')) {
      onAgentDelete(agentId)
    }
  }

  const toggleTool = (toolId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedTools: prev.selectedTools.includes(toolId)
        ? prev.selectedTools.filter(id => id !== toolId)
        : [...prev.selectedTools, toolId]
    }))
  }

  const getAgentToolCount = (agent: Agent) => {
    return agent.tools.length
  }

  const renderListView = () => (
    <ModalBody>
      <div className="flex flex-col h-[calc(80vh-8rem)] min-h-[500px]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium">Manage Agents</h3>
          <Button onClick={handleCreate} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            New Agent
          </Button>
        </div>

        {agents.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-center text-muted-foreground">
            <div>
              <Bot className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No agents created yet</p>
              <p className="text-xs">Create an agent to enable tool-based conversations</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-3 pr-2">
            {agents.sort((a, b) => a.name.localeCompare(b.name)).map((agent) => (
              <div
                key={agent.id}
                className="p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm truncate">{agent.name}</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      {agent.description || 'No description'}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <ToolIcon className="w-3 h-3" />
                        {getAgentToolCount(agent)} tools
                      </span>
                      <span>{formatTimestamp(agent.updatedAt)}</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEdit(agent)}
                      className="h-8 w-8 p-0"
                    >
                      <Edit2 className="w-3 h-3 flex-shrink-0" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(agent.id)}
                      className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-3 h-3 flex-shrink-0" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </ModalBody>
  )

  const renderFormView = () => (
    <>
      <ModalBody>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="agent-name">Name</Label>
            <Input
              id="agent-name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Agent name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="agent-description">Description</Label>
            <Input
              id="agent-description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Brief description of the agent"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="agent-instruction">Instruction</Label>
            <Textarea
              id="agent-instruction"
              value={formData.systemPrompt}
              onChange={(e) => setFormData(prev => ({ ...prev, systemPrompt: e.target.value }))}
              placeholder="Instruction for the agent"
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label>Available Tools ({formData.selectedTools.length} selected)</Label>
            {tools.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tools available. Create tools first.</p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto border rounded-md p-2">
                {tools.map((tool) => (
                  <label
                    key={tool.id}
                    className="flex items-center space-x-2 cursor-pointer hover:bg-muted/50 p-2 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={formData.selectedTools.includes(tool.id)}
                      onChange={() => toggleTool(tool.id)}
                      className="rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium">{tool.name}</span>
                      <p className="text-xs text-muted-foreground truncate">{tool.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </ModalBody>
      
      <ModalFooter>
        <Button variant="outline" onClick={handleCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={!formData.name.trim()}>
          {view === 'create' ? 'Create Agent' : 'Update Agent'}
        </Button>
      </ModalFooter>
    </>
  )

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={view === 'list' ? 'Agent Management' : (view === 'create' ? 'Create Agent' : 'Edit Agent')}
      size="lg"
    >
      {view === 'list' ? renderListView() : renderFormView()}
    </Modal>
  )
}
