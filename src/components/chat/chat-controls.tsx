'use client'

import React, { useState } from 'react'
import { Agent, Tool, APIConfig } from '@/types'
import { Button } from '@/components/ui/button'
import { CustomSelect } from '@/components/ui/custom-select'
import { Label } from '@/components/ui/label'
import { Bot, Wrench as ToolIcon, Plus, BookUser } from 'lucide-react'
import { AgentInstructionModal, AgentToolsModal } from '@/components/agents'

interface ChatControlsProps {
  agents: Agent[]
  currentAgentId: string | null
  tools: Tool[]
  hasMessages: boolean
  apiConfig: APIConfig
  onAgentSelect: (agentId: string | null) => void
  onNewChat: () => void
  onAgentInstructionUpdate: (agentId: string, instruction: string) => void
  onAgentToolsUpdate: (agentId: string, toolIds: string[]) => void
}

export function ChatControls({
  agents,
  currentAgentId,
  tools,
  hasMessages,
  apiConfig,
  onAgentSelect,
  onNewChat,
  onAgentInstructionUpdate,
  onAgentToolsUpdate
}: ChatControlsProps) {
  const [showInstructionModal, setShowInstructionModal] = useState(false)
  const [showToolsModal, setShowToolsModal] = useState(false)

  const currentAgent = agents.find(a => a.id === currentAgentId)

  const getToolButtonText = () => {
    if (!currentAgent) return 'No Tool'
    const toolCount = currentAgent.tools.length
    if (toolCount === 0) return 'No Tool'
    if (toolCount === 1) return '1 Tool'
    return `${toolCount} Tools`
  }

  return (
    <>
      <div className="border-b border-border bg-muted/30 py-3 px-4">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Agent Selection */}
          <div className="flex items-center gap-2 min-w-0">
            <Bot className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div className="flex items-center gap-2 min-w-0">
              <CustomSelect
                value={currentAgentId || 'none'}
                placeholder="Select Agent"
                options={[
                  { value: 'none', label: 'No Agent' },
                  ...agents.map(agent => ({
                    value: agent.id,
                    label: agent.name
                  }))
                ]}
                onChange={(value) => onAgentSelect(value === 'none' ? null : value)}
                width="min-w-[150px]"
                size="md"
              />
            </div>
          </div>

          {/* Agent Controls - only show when agent is selected */}
          {currentAgent && (
            <div className="flex items-center gap-2">
              {/* Instruction Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowInstructionModal(true)}
                className="flex items-center gap-1 text-xs"
              >
                <BookUser className="w-3 h-3" />
                Instruction
              </Button>

              {/* Tools Button */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowToolsModal(true)}
                className="flex items-center gap-1 text-xs"
              >
                <ToolIcon className="w-3 h-3" />
                {getToolButtonText()}
              </Button>
            </div>
          )}

          {/* New Chat Button */}
          <div className="flex items-center gap-2 ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={onNewChat}
            >
              <Plus className="w-4 h-4 mr-2" />
              New Chat
            </Button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <AgentInstructionModal
        isOpen={showInstructionModal}
        onClose={() => setShowInstructionModal(false)}
        agent={currentAgent || null}
        onSave={onAgentInstructionUpdate}
        apiConfig={apiConfig}
      />

      <AgentToolsModal
        isOpen={showToolsModal}
        onClose={() => setShowToolsModal(false)}
        agent={currentAgent || null}
        allTools={tools}
        onSave={onAgentToolsUpdate}
      />
    </>
  )
}
