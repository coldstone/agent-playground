'use client'

import React, { useState } from 'react'
import { Agent, Tool } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { CustomSelect } from '@/components/ui/custom-select'
import { generateId, truncateText, formatTimestamp } from '@/lib/utils'
import { Plus, Bot, Edit2, Trash2, Check, X, Settings, Wrench as ToolIcon } from 'lucide-react'

interface AgentManagerProps {
  agents: Agent[]
  currentAgentId: string | null
  onAgentSelect: (agentId: string | null) => void
  onAgentCreate: (agent: Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>) => void
  onAgentUpdate: (agentId: string, agent: Partial<Agent>) => void
  onAgentDelete: (agentId: string) => void
}

export function AgentManager({
  agents,
  currentAgentId,
  onAgentSelect,
  onAgentCreate,
  onAgentUpdate,
  onAgentDelete
}: AgentManagerProps) {
  const [isCreating, setIsCreating] = useState(false)
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    systemPrompt: '',
    tools: [] as string[]
  })

  const handleStartCreate = () => {
    setFormData({
      name: '',
      description: '',
      systemPrompt: 'You are a helpful AI assistant with access to tools. When you need to use a tool, call the appropriate function with the required parameters.',
      tools: []
    })
    setIsCreating(true)
  }

  const handleStartEdit = (agent: Agent) => {
    setFormData({
      name: agent.name,
      description: agent.description,
      systemPrompt: agent.systemPrompt,
      tools: agent.tools
    })
    setEditingAgentId(agent.id)
  }

  const handleSave = () => {
    if (!formData.name.trim()) return

    if (isCreating) {
      onAgentCreate(formData)
      setIsCreating(false)
    } else if (editingAgentId) {
      onAgentUpdate(editingAgentId, formData)
      setEditingAgentId(null)
    }

    setFormData({ name: '', description: '', systemPrompt: '', tools: [] })
  }

  const handleCancel = () => {
    setIsCreating(false)
    setEditingAgentId(null)
    setFormData({ name: '', description: '', systemPrompt: '', tools: [] })
  }

  const handleInputChange = (field: keyof typeof formData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const isEditing = isCreating || editingAgentId !== null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Bot className="w-5 h-5" />
          Agent Mode
        </h3>
        <div className="flex items-center gap-2">
          <CustomSelect
            value={currentAgentId || 'none'}
            placeholder="Select Agent"
            options={[
              { value: 'none', label: 'No Agent' },
              ...(agents?.map(agent => ({
                value: agent.id,
                label: agent.name
              })) || [])
            ]}
            onChange={(value) => onAgentSelect(value === 'none' ? null : value)}
            size="md"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={handleStartCreate}
            disabled={isEditing}
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {isEditing && (
        <div className="border border-border rounded-lg p-4 space-y-4 bg-card">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">
              {isCreating ? 'Create New Agent' : 'Edit Agent'}
            </h4>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={!formData.name.trim()}>
                <Check className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="outline" onClick={handleCancel}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="agent-name">Name</Label>
              <Input
                id="agent-name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Agent name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="agent-description">Description</Label>
              <Input
                id="agent-description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Brief description of the agent"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="agent-system-prompt">System Prompt</Label>
              <Textarea
                id="agent-system-prompt"
                value={formData.systemPrompt}
                onChange={(e) => handleInputChange('systemPrompt', e.target.value)}
                placeholder="System prompt for the agent"
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label>Tools ({formData.tools.length})</Label>
              <div className="text-sm text-muted-foreground">
                Tools will be managed in the Tools section below
              </div>
            </div>
          </div>
        </div>
      )}

      {agents && agents.length > 0 && !isEditing && (
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Available Agents</h4>
          <div className="space-y-2">
            {agents?.map((agent) => (
              <div
                key={agent.id}
                className={`p-3 rounded-lg border transition-colors ${
                  currentAgentId === agent.id
                    ? 'bg-primary/10 border-primary/20'
                    : 'hover:bg-muted border-border'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h5 className="font-medium text-sm truncate">{agent.name}</h5>
                    <p className="text-xs text-muted-foreground mt-1">
                      {agent.description || 'No description'}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <ToolIcon className="w-3 h-3" />
                        {agent.tools.length} tools
                      </span>
                      <span>{formatTimestamp(agent.updatedAt)}</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleStartEdit(agent)}
                      className="h-6 w-6 p-0"
                    >
                      <Edit2 className="w-3 h-3 flex-shrink-0" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onAgentDelete(agent.id)}
                      className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-3 h-3 flex-shrink-0" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(!agents || agents.length === 0) && !isEditing && (
        <div className="text-center py-8 text-muted-foreground">
          <Bot className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No agents created yet</p>
          <p className="text-xs">Create an agent to enable tool-based conversations</p>
        </div>
      )}
    </div>
  )
}
