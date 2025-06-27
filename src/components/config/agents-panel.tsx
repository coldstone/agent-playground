'use client'

import React, { useState } from 'react'
import { Agent, Tool } from '@/types'
import { AgentFormModal } from '@/components/agents/agent-form-modal'
import { AgentInstructionModal, AgentToolsModal } from '@/components/agents'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import {
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Trash2, Edit2, Bot, BookUser, Wrench as ToolIcon, GripVertical } from 'lucide-react'
import { formatTimestamp } from '@/lib/utils'

interface SortableAgentCardProps {
  agent: Agent
  onEdit: (agent: Agent) => void
  onDelete: (agent: Agent) => void
  onInstructionClick: (agent: Agent) => void
  onToolsClick: (agent: Agent) => void
}

function SortableAgentCard({
  agent,
  onEdit,
  onDelete,
  onInstructionClick,
  onToolsClick,
}: SortableAgentCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: agent.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group p-4 pl-1 rounded-lg border border-border hover:bg-muted/50 transition-colors ${
        isDragging ? 'shadow-lg opacity-50' : ''
      }`}
    >
      <div className="flex gap-2">
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="flex items-center justify-center w-4 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
        >
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
                onClick={() => onInstructionClick(agent)}
                className="h-5 w-5 flex items-center justify-center hover:bg-muted rounded transition-colors"
                title="Edit Instruction"
              >
                <BookUser className="w-3 h-3" />
              </button>
              <button
                onClick={() => onToolsClick(agent)}
                className="h-5 w-5 flex items-center justify-center hover:bg-muted rounded transition-colors"
                title="Manage Tools"
              >
                <ToolIcon className="w-3 h-3" />
              </button>
              <button
                onClick={() => onEdit(agent)}
                className="h-5 w-5 flex items-center justify-center hover:bg-muted rounded transition-colors"
                title="Edit Agent"
              >
                <Edit2 className="w-3 h-3" />
              </button>
              <button
                onClick={() => onDelete(agent)}
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
  )
}

interface AgentsPanelProps {
  agents: Agent[]
  tools: Tool[]
  onAgentUpdate: (agentId: string, updates: Partial<Agent>) => void
  onAgentDelete: (agentId: string) => void
  onAgentReorder: (agents: Agent[]) => void
  apiConfig: any // For instruction modal
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

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // Sort agents by order field
  const sortedAgents = agents.sort((a, b) => (a.order || 0) - (b.order || 0))

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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event

    if (active.id !== over?.id) {
      const oldIndex = sortedAgents.findIndex((agent) => agent.id === active.id)
      const newIndex = sortedAgents.findIndex((agent) => agent.id === over?.id)

      const reorderedAgents = arrayMove(sortedAgents, oldIndex, newIndex)
      onAgentReorder(reorderedAgents)
    }
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
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={sortedAgents.map(agent => agent.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-3">
                {sortedAgents.map((agent) => (
                  <SortableAgentCard
                    key={agent.id}
                    agent={agent}
                    onEdit={handleEdit}
                    onDelete={handleDeleteClick}
                    onInstructionClick={handleInstructionClick}
                    onToolsClick={handleToolsClick}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
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

      {/* Instruction Modal */}
      {selectedAgent && (
        <AgentInstructionModal
          isOpen={showInstructionModal}
          onClose={() => {
            setShowInstructionModal(false)
            setSelectedAgent(null)
          }}
          agent={selectedAgent}
          onSave={handleInstructionUpdate}
          apiConfig={apiConfig}
        />
      )}

      {/* Tools Modal */}
      {selectedAgent && (
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
    </>
  )
}
