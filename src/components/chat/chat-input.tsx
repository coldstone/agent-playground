'use client'

import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import { Button } from '@/components/ui/button'
import { ModelSelector } from '@/components/ui/model-selector'
import { ToolSelector } from '@/components/ui/tool-selector'
import { AutoSwitch } from '@/components/ui/auto-switch'
import { ArrowUp, Square } from 'lucide-react'
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
  webFetchEnabled?: boolean
  webSearchEnabled?: boolean
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
  webFetchEnabled = false,
  webSearchEnabled = false,
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
      <form onSubmit={handleSubmit}>
        {/* One container holds the textarea and the toolbar: the textarea is borderless and the
            focus ring lives on the wrapper via focus-within, so the whole box lights up as one
            control instead of a field inside a frame. */}
        <div className="relative rounded-2xl border border-border bg-background shadow-sm transition-colors focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
          {/* Anchored to the container so the "/" popover still opens above the whole box */}
          {skillAutocomplete.popover}
          {/* A raw textarea, not the shared <Textarea>, and the overlay does the same. cn() here
              is plain clsx with no tailwind-merge, so the base component's rounded-md, border and
              focus-visible:ring-2 stay in the class list next to any override and Tailwind's own
              emission order decides the winner - which drew a rounded ring inside this container.
              Nothing to override when the classes are not there in the first place. */}
          <textarea
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
            className="w-full min-h-[60px] max-h-[200px] px-4 pt-3 bg-transparent border-0 resize-none text-sm focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed text-foreground placeholder:text-muted-foreground"
            rows={1}
          />
          <div className="flex items-center gap-2 px-3 pb-2.5">
            <div className="flex items-center flex-wrap gap-x-3 gap-y-2 min-w-0">
              {!currentAgent && tools.length > 0 && onToolsChange && (
                <ToolSelector
                  tools={tools}
                  selectedToolIds={selectedToolIds}
                  onToolsChange={onToolsChange}
                />
              )}
              {/* Auto switch lives in the left cluster in both modes. The model selector can
                  render one of its own, but it sits in the right cluster, so letting it do so in
                  agent mode made the switch jump sides the moment an agent was picked.
                  Agent mode: always offered, an agent always carries tools. No-agent mode:
                  offered whenever anything is callable, local tools or not, since MCP, skill and
                  built-in tools do not need a tool selection. */}
              {onAutoModeChange && (currentAgent || tools.length > 0 || mcpToolCount > 0 || skillCount > 0 || webFetchEnabled || webSearchEnabled) && (
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
              {/* Icon sizes are derived, not guessed: lucide draws ArrowUp across 14 of its 24
                  viewBox units, so a 22px box shows a 12.8px arrow - 35% of the 36px circle - and
                  strokeWidth 2 renders as 1.8px at that scale. Square spans 18 of 24, so a 16px
                  box shows 12px, kept below the arrow because a solid fill already reads heavier
                  than a hairline stroke. shrink-0 keeps the flex row from squashing either.
                  Send and Stop share a footprint so the row does not jump when streaming starts. */}
              {isLoading ? (
                <Button
                  type="button"
                  onClick={handleStop}
                  variant="destructive"
                  size="sm"
                  aria-label="Stop"
                  title="Stop"
                  className="h-9 w-9 p-0 rounded-full flex items-center justify-center"
                  rounded={true}
                >
                  <Square className="w-[16px] h-[16px] shrink-0" fill="currentColor" strokeWidth={0} />
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={!input.trim() || disabled || !hasValidCurrentModel}
                  size="sm"
                  aria-label="Send"
                  title="Send (Enter)"
                  className="h-9 w-9 p-0 rounded-full flex items-center justify-center"
                  rounded={true}
                >
                  <ArrowUp className="w-[22px] h-[22px] shrink-0" strokeWidth={2} />
                </Button>
              )}
            </div>
          </div>
        </div>
      </form>
    </div>
  )
})
