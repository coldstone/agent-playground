'use client'

import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ModelSelector } from '@/components/ui/model-selector'
import { ToolSelector } from '@/components/ui/tool-selector'
import { AutoSwitch } from '@/components/ui/auto-switch'
import { Send, Square } from 'lucide-react'
import { useSkillAutocomplete } from './skill-autocomplete'
import { ToolCountBadges } from './tool-count-badges'

// Stable identity so the autocomplete memo does not recompute on every render
const EMPTY_SKILLS: Skill[] = []
import { useDraftMessage } from '@/hooks/use-draft-message'
import { useAvailableModels } from '@/hooks/use-available-models'
import { Tool, Skill } from '@/types'

interface ChatInputProps {
  onSendMessage: (content: string, selectedToolIds?: string[]) => void
  isLoading: boolean
  onStop?: () => void
  disabled?: boolean
  disabledReason?: string
  currentAgent?: { name: string } | null
  tools?: Tool[]
  selectedToolIds?: string[]
  onToolsChange?: (toolIds: string[]) => void
  mcpToolCount?: number
  skillCount?: number
  skills?: Skill[]
  autoMode?: boolean
  onAutoModeChange?: (enabled: boolean) => void
}

export interface ChatInputRef {
  focus: () => void
}

export const ChatInput = forwardRef<ChatInputRef, ChatInputProps>(function ChatInput({
  onSendMessage,
  isLoading,
  onStop,
  disabled,
  disabledReason,
  currentAgent,
  tools = [],
  selectedToolIds = [],
  onToolsChange,
  mcpToolCount = 0,
  skillCount = 0,
  skills = EMPTY_SKILLS,
  autoMode = false,
  onAutoModeChange
}, ref) {
  const { message: input, setMessage: setInput, clearDraft } = useDraftMessage()
  const { hasAvailableModels, hasValidCurrentModel } = useAvailableModels()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (input.trim() && !isLoading && !disabled && hasValidCurrentModel) {
      onSendMessage(input.trim(), selectedToolIds)
      clearDraft()
    }
  }

  const skillAutocomplete = useSkillAutocomplete({ value: input, skills, onComplete: setInput })

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // The popover owns Enter/Tab/arrows while it is open, so completing never sends
    if (skillAutocomplete.handleKeyDown(e)) return

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  const handleStop = () => {
    if (onStop) {
      onStop()
    }
  }

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [input])

  // Auto-focus on mount
  useEffect(() => {
    if (textareaRef.current && !disabled) {
      textareaRef.current.focus()
    }
  }, [disabled])

  // Expose focus method to parent
  useImperativeHandle(ref, () => ({
    focus: () => {
      if (textareaRef.current && !disabled) {
        textareaRef.current.focus()
      }
    }
  }), [disabled])

  return (
    <div className="border-t border-border bg-card p-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex-1 relative">
          {skillAutocomplete.popover}
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              !hasAvailableModels ? "Please configure LLM first..." :
              !hasValidCurrentModel ? "Please select a model..." :
              disabledReason ? disabledReason :
              "Type your message..."
            }
            disabled={disabled || isLoading || !hasValidCurrentModel}
            className="min-h-[60px] max-h-[200px] resize-none w-full"
            rows={1}
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center flex-wrap gap-x-4 gap-y-2 min-w-0">
            <ModelSelector 
              autoMode={autoMode}
              onAutoModeChange={onAutoModeChange}
              showAutoSwitch={!!currentAgent} // Only show auto switch in Agent mode
            />
            {!currentAgent && tools.length > 0 && onToolsChange && (
              <ToolSelector
                tools={tools}
                selectedToolIds={selectedToolIds}
                onToolsChange={onToolsChange}
              />
            )}
            {/* Auto switch in Non-Agent mode: offered whenever anything is callable, local
                tools or not, since MCP and skill tools do not need a tool selection */}
            {!currentAgent && onAutoModeChange && (tools.length > 0 || mcpToolCount > 0 || skillCount > 0) && (
              <AutoSwitch
                autoMode={autoMode}
                onAutoModeChange={onAutoModeChange}
              />
            )}
            {/* Counts go last, after the auto switch */}
            <ToolCountBadges mcpToolCount={mcpToolCount} skillCount={skillCount} />
          </div>
          <div className="flex gap-2">
            {isLoading ? (
              <Button
                type="button"
                onClick={handleStop}
                variant="destructive"
                size="sm"
                className="h-8 px-3 w-28"
                rounded={true}
              >
                <Square className="w-4 h-4 mr-1" />
                Stop
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={!input.trim() || disabled || !hasValidCurrentModel}
                size="sm"
                className="h-8 px-3 w-28"
                rounded={true}
              >
                <Send className="w-4 h-4 mr-1" />
                Send
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  )
})
