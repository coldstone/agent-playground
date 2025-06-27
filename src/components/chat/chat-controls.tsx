'use client'

import React, { useState } from 'react'
import { Agent, Tool, APIConfig } from '@/types'
import { Button } from '@/components/ui/button'
import { BookUser, Wrench as ToolIcon, Bot } from 'lucide-react'
import { AgentInstructionModal, AgentToolsModal } from '@/components/agents'

interface ChatControlsProps {
  agents: Agent[]
  currentAgentId: string | null
  tools: Tool[]
  hasMessages: boolean
  apiConfig: APIConfig
  onAgentSelect: (agentId: string | null) => void
  onAgentInstructionUpdate: (agentId: string, instruction: string) => void
  onAgentToolsUpdate: (agentId: string, toolIds: string[]) => void
  onCreateAgent: () => void
}

export function ChatControls({
  agents,
  currentAgentId,
  tools,
  hasMessages,
  apiConfig,
  onAgentSelect,
  onAgentInstructionUpdate,
  onAgentToolsUpdate,
  onCreateAgent
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
      <div className="border-b border-border bg-muted/30">
        {/* Unified Agent info layout for both cases */}
        <div className="py-3 px-4">
          <div className="flex items-center justify-between">
            {/* Agent Info */}
            <div className="flex items-center gap-3">
              {currentAgent ? (
                <div className="flex items-start gap-2">
                  <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-medium text-sm">{currentAgent.name}</h3>
                    <p className="text-xs text-muted-foreground">{currentAgent.description}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-medium text-sm">No Agent</h3>
                    <p className="text-xs text-muted-foreground">Configure an agent to get started</p>
                  </div>
                </div>
              )}
            </div>

            {/* Agent Controls */}
            <div className="flex items-center gap-2">
              {currentAgent && (
                <>
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
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {currentAgent && (
        <>
          <AgentInstructionModal
            isOpen={showInstructionModal}
            onClose={() => setShowInstructionModal(false)}
            agent={currentAgent}
            onSave={(agentId: string, instruction: string) => onAgentInstructionUpdate(agentId, instruction)}
            apiConfig={apiConfig}
          />
          <AgentToolsModal
            isOpen={showToolsModal}
            onClose={() => setShowToolsModal(false)}
            agent={currentAgent}
            allTools={tools}
            onSave={(agentId: string, toolIds: string[]) => onAgentToolsUpdate(agentId, toolIds)}
          />
        </>
      )}
    </>
  )
}