'use client'

import React, { useState, useCallback } from 'react'
import { DndProvider, useDrag, useDrop } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { Agent, Tool, Authorization } from '@/types'
import { AgentFormModal } from '@/components/agents/agent-form-modal'
import { AgentInstructionModal, AgentToolsModal } from '@/components/agents'
import { Trash2, Edit2, Bot, BookUser, Wrench as ToolIcon, GripVertical } from 'lucide-react'
import { formatTimestamp } from '@/lib/utils'

const ItemTypes = {
  AGENT: 'agent'
}

interface AgentsPanelProps {
  agents: Agent[]
  tools: Tool[]
  authorizations: Authorization[]
  currentAgentId?: string | null
  onAgentUpdate: (agentId: string, updates: Partial<Agent>) => void
  onAgentDelete: (agentId: string) => void
  onAgentReorder: (agents: Agent[]) => void
  onAgentClearSelection?: () => void
  onToolCreate: (tool: Tool) => void
  apiConfig: any
}

interface DraggableAgentCardProps {
  agent: Agent
  index: number
  moveAgent: (dragIndex: number, hoverIndex: number) => void
  onEdit: (agent: Agent) => void
  onDelete: (agent: Agent) => void
  onEditInstruction: (agent: Agent) => void
  onManageTools: (agent: Agent) => void
  onToggleVisibility: (agent: Agent) => void
}

function DraggableAgentCard({
  agent,
  index,
  moveAgent,
  onEdit,
  onDelete,
  onEditInstruction,
  onManageTools,
  onToggleVisibility
}: DraggableAgentCardProps) {
  const ref = React.useRef<HTMLDivElement>(null)

  const [{ isDragging }, drag] = useDrag({
    type: ItemTypes.AGENT,
    item: { index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging()
    })
  })

  const [, drop] = useDrop({
    accept: ItemTypes.AGENT,
    hover: (item: { index: number }, monitor) => {
      if (!ref.current) return

      const dragIndex = item.index
      const hoverIndex = index

      // Don't replace items with themselves
      if (dragIndex === hoverIndex) return

      // Get the hovered element's bounding rectangle
      const hoverBoundingRect = ref.current.getBoundingClientRect()

      // Get vertical middle
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2

      // Determine mouse position
      const clientOffset = monitor.getClientOffset()
      if (!clientOffset) return

      // Get pixels to the top
      const hoverClientY = clientOffset.y - hoverBoundingRect.top

      // Only perform the move when the mouse has crossed half of the items height
      // When dragging downwards, only move when the cursor is below 50%
      // When dragging upwards, only move when the cursor is above 50%
      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) return
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) return

      // Time to actually perform the action
      moveAgent(dragIndex, hoverIndex)

      // Note: we're mutating the monitor item here!
      // Generally it's better to avoid mutations,
      // but it's good here for the sake of performance
      // to avoid expensive index searches.
      item.index = hoverIndex
    }
  })

  // Connect drag and drop to the same element
  React.useEffect(() => {
    if (ref.current) {
      drag(drop(ref.current))
    }
  }, [drag, drop])

  return (
    <div
      ref={ref}
      className={`group p-4 pl-1 rounded-lg border border-border hover:bg-muted/50 transition-colors ${
        isDragging ? 'opacity-50 shadow-lg' : ''
      }`}
      style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
    >
      <div className="flex gap-2">
        <div className="flex items-center justify-center w-4 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing">
          <GripVertical className="w-3 h-3 text-muted-foreground" />
        </div>

        <div className="flex-1 flex flex-col gap-2">
          <div className="flex-1">
            <div className="flex items-start justify-between mb-1">
              <h5 className="font-medium text-sm">{agent.name}</h5>
              {/* Mini visibility switch */}
              <label 
                className="relative inline-flex items-center cursor-pointer"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={agent.visible !== false} // default to true if undefined
                  onChange={(e) => {
                    e.stopPropagation()
                    onToggleVisibility(agent)
                  }}
                  className="sr-only"
                />
                <div className={`w-7 h-4 rounded-full transition-colors ${
                  agent.visible !== false ? 'bg-green-500' : 'bg-gray-300'
                }`}>
                  <div className={`w-3 h-3 bg-white rounded-full shadow transform transition-transform ${
                    agent.visible !== false ? 'translate-x-3.5' : 'translate-x-0.5'
                  } mt-0.5`} />
                </div>
              </label>
            </div>
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
              {formatTimestamp(agent.updatedAt || agent.createdAt)}
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onEditInstruction(agent)}
                className="h-5 w-5 flex items-center justify-center hover:bg-muted rounded transition-colors"
                title="Edit Instruction"
              >
                <BookUser className="w-3 h-3" />
              </button>
              <button
                onClick={() => onManageTools(agent)}
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

export function AgentsPanel({
  agents,
  tools,
  authorizations,
  currentAgentId,
  onAgentUpdate,
  onAgentDelete,
  onAgentReorder,
  onAgentClearSelection,
  onToolCreate,
  apiConfig
}: AgentsPanelProps) {
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [agentToDelete, setAgentToDelete] = useState<Agent | null>(null)
  const [showInstructionModal, setShowInstructionModal] = useState(false)
  const [showToolsModal, setShowToolsModal] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null)
  const [localAgents, setLocalAgents] = useState<Agent[]>([])

  // 同步本地agents状态
  React.useEffect(() => {
    const sortedAgents = [...agents].sort((a, b) => (a.order || 0) - (b.order || 0))
    setLocalAgents(sortedAgents)
  }, [agents])

  const handleInstructionClick = (agent: Agent) => {
    setSelectedAgent(agent)
    setShowInstructionModal(true)
  }

  const handleToolsClick = (agent: Agent) => {
    setSelectedAgent(agent)
    setShowToolsModal(true)
  }

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

  const moveAgent = useCallback((dragIndex: number, hoverIndex: number) => {
    const newAgents = [...localAgents]
    const draggedAgent = newAgents[dragIndex]
    newAgents.splice(dragIndex, 1)
    newAgents.splice(hoverIndex, 0, draggedAgent)
    setLocalAgents(newAgents)

    // 立即更新排序，确保覆盖层按钮顺序实时更新
    const updatedAgents = newAgents.map((agent, index) => ({
      ...agent,
      order: index
    }))
    onAgentReorder(updatedAgents)
  }, [localAgents, onAgentReorder])

  const handleDragEnd = () => {
    // 立即保存排序结果，确保覆盖层按钮顺序实时更新
    const updatedAgents = localAgents.map((agent, index) => ({
      ...agent,
      order: index
    }))
    onAgentReorder(updatedAgents)
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

  const handleToggleVisibility = (agent: Agent) => {
    const newVisibility = agent.visible === false
    
    // If we're hiding the current selected agent, clear the selection
    if (!newVisibility && currentAgentId === agent.id && onAgentClearSelection) {
      onAgentClearSelection()
    }
    
    onAgentUpdate(agent.id, { visible: newVisibility })
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="space-y-3">
        {localAgents.length === 0 ? (
          <div className="flex items-center justify-center text-center text-muted-foreground py-8">
            <div>
              <Bot className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No agents created yet</p>
              <p className="text-xs">Create agents to enable specialized functionality</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {localAgents.map((agent, index) => (
              <DraggableAgentCard
                key={agent.id}
                agent={agent}
                index={index}
                moveAgent={moveAgent}
                onEdit={handleEdit}
                onDelete={handleDeleteClick}
                onEditInstruction={handleInstructionClick}
                onManageTools={handleToolsClick}
                onToggleVisibility={handleToggleVisibility}
              />
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
        authorizations={authorizations}
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
          authorizations={authorizations}
          onSave={handleToolsUpdate}
          onToolCreate={onToolCreate}
        />
      )}
    </DndProvider>
  )
}
