'use client'

import React, { useRef, useEffect, useState } from 'react'
import { Agent, Tool } from '@/types'
import { Button } from '@/components/ui/button'
import { ModelSelector } from '@/components/ui/model-selector'
import { ToolSelector } from '@/components/ui/tool-selector'
import { AutoSwitch } from '@/components/ui/auto-switch'
import { Plus, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDraftMessage } from '@/hooks/use-draft-message'
import { useAvailableModels } from '@/hooks/use-available-models'

interface NewChatOverlayProps {
  agents: Agent[]
  currentAgentId: string | null
  onSendMessage: (content: string, agentId: string | null, toolIds?: string[]) => void
  onCreateAgent: () => void
  onAgentSelect: (agentId: string | null) => void
  shouldFocus?: boolean
  tools?: Tool[]
  autoMode?: boolean
  onAutoModeChange?: (enabled: boolean) => void
}

export function NewChatOverlay({
  agents,
  currentAgentId,
  onSendMessage,
  onCreateAgent,
  onAgentSelect,
  shouldFocus = true,
  tools = [],
  autoMode = false,
  onAutoModeChange
}: NewChatOverlayProps) {
  const { message, setMessage, clearDraft } = useDraftMessage()
  const { hasAvailableModels, hasValidCurrentModel } = useAvailableModels()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>([])

  // Focus on textarea when component mounts, when agents change, or when shouldFocus changes
  useEffect(() => {
    if (shouldFocus && textareaRef.current) {
      // Use a small delay to ensure the component is fully rendered
      const timer = setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus()
        }
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [agents.length, shouldFocus]) // Re-focus when agents list changes or shouldFocus changes

  const handleSend = () => {
    if (!message.trim() || !hasValidCurrentModel) return

    onSendMessage(message, currentAgentId, !currentAgentId ? selectedToolIds : undefined)

    // Clear draft from localStorage after sending
    clearDraft()
  }

  const handleAgentToggle = (agentId: string) => {
    const newAgentId = currentAgentId === agentId ? null : agentId
    onAgentSelect(newAgentId)

    // Keep focus on textarea after agent selection
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
      }
    }, 0)
  }

  const handleCreateAgent = () => {
    onCreateAgent()

    // Keep focus on textarea after modal closes
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
      }
    }, 100)
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-background p-8">
      {/* Logo and Welcome Message */}
      <div className="text-center mb-8">
        <div className="mb-6">
          <img
            src="/logo.svg"
            alt="Agent Playground Logo"
            className="w-16 h-16 mx-auto mb-4 opacity-80"
          />
        </div>
        <h2 className="text-2xl font-semibold mb-2">Welcome to Agent Playground</h2>
        <p className="text-muted-foreground">Choose an agent and type your message to begin</p>
      </div>

      {/* Agent Selection */}
      <div className="w-full max-w-4xl mb-8">
        <div className="flex flex-wrap gap-2 justify-center">
          {/* Agent Buttons */}
          {agents
            .filter(agent => agent.visible !== false) // Only show visible agents (default to visible if undefined)
            .sort((a, b) => (a.order || 0) - (b.order || 0))
            .map((agent) => (
            <Button
              key={agent.id}
              variant={currentAgentId === agent.id ? "default" : "outline"}
              onClick={() => handleAgentToggle(agent.id)}
              className={cn(
                "!rounded-full px-4 py-2 text-sm font-normal border transition-all duration-200 h-auto",
                currentAgentId === agent.id
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "hover:bg-muted/50 hover:border-muted-foreground/50"
              )}
            >
              {agent.name}
            </Button>
          ))}

          {/* New Agent Button - at the end */}
          <Button
            variant="outline"
            onClick={handleCreateAgent}
            className="!rounded-full px-4 py-2 text-sm font-normal border hover:bg-muted/50 transition-all duration-200 h-auto text-primary"
          >
            <Plus className="w-3 h-3 mr-1" />
            New Agent
          </Button>
        </div>
      </div>

      {/* Chat Input */}
      <div className="w-full max-w-2xl">
        <div className="space-y-3">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={!hasAvailableModels ? "Please configure LLM first..." : !hasValidCurrentModel ? "Please select a model..." : "Type your message..."}
            disabled={!hasValidCurrentModel}
            className="w-full min-h-[100px] p-3 border border-border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            autoFocus
          />
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <ModelSelector 
                autoMode={autoMode}
                onAutoModeChange={onAutoModeChange}
                showAutoSwitch={!!currentAgentId} // Only show auto switch in Agent mode
              />
              {!currentAgentId && tools.length > 0 && (
                <>
                  <ToolSelector
                    tools={tools}
                    selectedToolIds={selectedToolIds}
                    onToolsChange={setSelectedToolIds}
                  />
                  {/* Auto switch in Non-Agent mode - place after tool selector */}
                  {onAutoModeChange && (
                    <AutoSwitch
                      autoMode={autoMode}
                      onAutoModeChange={onAutoModeChange}
                    />
                  )}
                </>
              )}
            </div>
            <Button
              onClick={handleSend}
              disabled={!message.trim() || !hasValidCurrentModel}
              size="sm"
              className="h-8 w-28"
              rounded={true}
            >
              <Send className="w-4 h-4 mr-2" />
              Send
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
