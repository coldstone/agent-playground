'use client'

import React, { useRef, useEffect } from 'react'
import { Agent } from '@/types'
import { Button } from '@/components/ui/button'
import { Plus, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDraftMessage } from '@/hooks/use-draft-message'

interface NewChatOverlayProps {
  agents: Agent[]
  currentAgentId: string | null
  onSendMessage: (content: string, agentId: string | null) => void
  onCreateAgent: () => void
  onAgentSelect: (agentId: string | null) => void
}

export function NewChatOverlay({
  agents,
  currentAgentId,
  onSendMessage,
  onCreateAgent,
  onAgentSelect
}: NewChatOverlayProps) {
  const { message, setMessage, clearDraft } = useDraftMessage()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Focus on textarea when component mounts or when agents change
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [agents.length]) // Re-focus when agents list changes (new agent added)

  const handleSend = () => {
    if (!message.trim()) return

    onSendMessage(message, currentAgentId)

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
          {agents.map((agent) => (
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
            placeholder="Type your message..."
            className="w-full min-h-[100px] p-3 border border-border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSend()
              }
            }}
            autoFocus
          />
          <div className="flex justify-between items-center">
            <div className="text-xs text-muted-foreground">
              Press Enter to send, Shift+Enter for new line
            </div>
            <Button
              onClick={handleSend}
              disabled={!message.trim()}
              size="sm"
              className="h-8"
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
