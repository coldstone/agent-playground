'use client'

import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ModelSelector } from '@/components/ui/model-selector'
import { Send, Square } from 'lucide-react'
import { useDraftMessage } from '@/hooks/use-draft-message'
import { useAvailableModels } from '@/hooks/use-available-models'

interface ChatInputProps {
  onSendMessage: (content: string) => void
  isLoading: boolean
  onStop?: () => void
  disabled?: boolean
  currentAgent?: { name: string } | null
}

export interface ChatInputRef {
  focus: () => void
}

export const ChatInput = forwardRef<ChatInputRef, ChatInputProps>(function ChatInput({
  onSendMessage,
  isLoading,
  onStop,
  disabled,
  currentAgent
}, ref) {
  const { message: input, setMessage: setInput, clearDraft } = useDraftMessage()
  const { hasAvailableModels } = useAvailableModels()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (input.trim() && !isLoading && !disabled) {
      onSendMessage(input.trim())
      clearDraft()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
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
    <div className="border-t border-border bg-background p-4">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="flex-1">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={!hasAvailableModels ? "Please configure LLM first..." : "Type your message..."}
            disabled={disabled || isLoading || !hasAvailableModels}
            className="min-h-[60px] max-h-[200px] resize-none"
            rows={1}
          />
        </div>
        <div className="flex flex-col gap-2">
          {isLoading ? (
            <Button
              type="button"
              onClick={handleStop}
              variant="destructive"
              size="icon"
              className="h-[60px] w-12"
            >
              <Square className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={!input.trim() || disabled || !hasAvailableModels}
              size="icon"
              className="h-[60px] w-12"
            >
              <Send className="w-4 h-4" />
            </Button>
          )}
        </div>
      </form>
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <ModelSelector />
          <span className='text-xs text-muted-foreground'>Press Enter to send, Shift+Enter for new line</span>
        </div>
      </div>
    </div>
  )
})
