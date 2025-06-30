'use client'

import React, { useState, useEffect } from 'react'
import { Modal, ModalBody, ModalFooter } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

interface SystemPromptModalProps {
  isOpen: boolean
  onClose: () => void
  initialPrompt?: string
  onSave: (prompt: string) => void
}

export function SystemPromptModal({
  isOpen,
  onClose,
  initialPrompt = '',
  onSave
}: SystemPromptModalProps) {
  const [prompt, setPrompt] = useState(initialPrompt)

  useEffect(() => {
    if (isOpen) {
      setPrompt(initialPrompt)
    }
  }, [isOpen, initialPrompt])

  const handleSave = () => {
    onSave(prompt)
    onClose()
  }

  const handleCancel = () => {
    setPrompt(initialPrompt)
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleCancel}
      title="Edit System Prompt"
      size="lg"
    >
      <ModalBody>
        <div className="space-y-4">
          <div>
            <Label htmlFor="system-prompt">System Prompt</Label>
            <Textarea
              id="system-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter system prompt for this conversation..."
              rows={8}
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              This system prompt will be used for this conversation only. It will override the global system prompt.
            </p>
          </div>
        </div>
      </ModalBody>
      
      <ModalFooter>
        <Button variant="outline" onClick={handleCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave}>
          Save System Prompt
        </Button>
      </ModalFooter>
    </Modal>
  )
}
