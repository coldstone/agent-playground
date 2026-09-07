'use client'

import React, { useRef, useEffect, useState } from 'react'
import { Agent, Tool, Skill } from '@/types'
import { Button } from '@/components/ui/button'
import { ModelSelector } from '@/components/ui/model-selector'
import { ToolSelector } from '@/components/ui/tool-selector'
import { AutoSwitch } from '@/components/ui/auto-switch'
import { useSkillAutocomplete } from './skill-autocomplete'
import { ToolCountBadges } from './tool-count-badges'

// Stable identity so the autocomplete memo does not recompute on every render
const EMPTY_SKILLS: Skill[] = []
import { Plus, ArrowUp } from 'lucide-react'
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
  mcpToolCount?: number
  skillCount?: number
  webFetchEnabled?: boolean
  webSearchEnabled?: boolean
  skills?: Skill[]
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
  onAutoModeChange,
  mcpToolCount = 0,
  skillCount = 0,
  webFetchEnabled = false,
  webSearchEnabled = false,
  skills = EMPTY_SKILLS
}: NewChatOverlayProps) {
  const { message, setMessage, clearDraft } = useDraftMessage()
  const { hasAvailableModels, hasValidCurrentModel } = useAvailableModels()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>([])
  const skillAutocomplete = useSkillAutocomplete({ value: message, skills, onComplete: setMessage })

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
      <div className="w-full max-w-3xl mb-8">
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

      {/* Chat Input - one container holds the textarea and the toolbar, matching chat-input.tsx.
          The textarea is borderless and the focus ring lives on the wrapper via focus-within, so
          the whole box lights up as one control. */}
      <div className="w-full max-w-3xl">
        <div className="relative rounded-2xl border border-border bg-background shadow-sm transition-colors focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
          {/* Anchored to the container so the "/" popover still opens above the whole box */}
          {skillAutocomplete.popover}
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={!hasAvailableModels ? "Please configure LLM first..." : !hasValidCurrentModel ? "Please select a model..." : "Type your message..."}
            disabled={!hasValidCurrentModel}
            className="w-full min-h-[100px] px-4 pt-3 bg-transparent border-0 resize-none focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed text-foreground placeholder:text-muted-foreground"
            onKeyDown={(e) => {
              // The popover owns Enter/Tab/arrows while it is open, so completing never sends
              if (skillAutocomplete.handleKeyDown(e)) return
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            autoFocus
          />
          <div className="flex items-center gap-2 px-3 pb-2.5">
            <div className="flex items-center flex-wrap gap-x-3 gap-y-2 min-w-0">
              {!currentAgentId && tools.length > 0 && (
                <ToolSelector
                  tools={tools}
                  selectedToolIds={selectedToolIds}
                  onToolsChange={setSelectedToolIds}
                />
              )}
              {/* Auto switch lives in the left cluster in both modes. The model selector can
                  render one of its own, but it sits in the right cluster, so letting it do so in
                  agent mode made the switch jump sides the moment an agent was picked.
                  Agent mode: always offered, an agent always carries tools. No-agent mode:
                  offered whenever anything is callable, local tools or not, since MCP, skill and
                  built-in tools do not need a tool selection. */}
              {onAutoModeChange && (currentAgentId || tools.length > 0 || mcpToolCount > 0 || skillCount > 0 || webFetchEnabled || webSearchEnabled) && (
                <AutoSwitch
                  autoMode={autoMode}
                  onAutoModeChange={onAutoModeChange}
                />
              )}
              {/* Counts go last, after the auto switch */}
              <ToolCountBadges
                mcpToolCount={mcpToolCount}
                skillCount={skillCount}
                webFetchEnabled={webFetchEnabled}
                webSearchEnabled={webSearchEnabled}
              />
            </div>
            <div className="ml-auto flex items-center gap-2 flex-shrink-0">
              <ModelSelector
                autoMode={autoMode}
                onAutoModeChange={onAutoModeChange}
                showAutoSwitch={false} // The left cluster owns it in both modes
              />
              <Button
                onClick={handleSend}
                disabled={!message.trim() || !hasValidCurrentModel}
                size="sm"
                aria-label="Send"
                title="Send (Enter)"
                className="h-9 w-9 p-0 rounded-full flex-shrink-0 flex items-center justify-center"
                rounded={true}
              >
                <ArrowUp className="w-[22px] h-[22px] shrink-0" strokeWidth={2} />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
