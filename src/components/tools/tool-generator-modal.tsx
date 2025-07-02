'use client'

import React, { useState } from 'react'
import { Modal, ModalBody, ModalFooter } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Sparkles, Loader2 } from 'lucide-react'
import { useToast } from '@/components/ui/toast'

interface ToolGeneratorModalProps {
  isOpen: boolean
  onClose: () => void
  onGenerate: (prompt: string) => Promise<void>
  isGenerating: boolean
}

export function ToolGeneratorModal({
  isOpen,
  onClose,
  onGenerate,
  isGenerating
}: ToolGeneratorModalProps) {
  const [prompt, setPrompt] = useState('')
  const { showToast, ToastContainer } = useToast()

  const handleGenerate = async () => {
    if (!prompt.trim()) return
    
    try {
      await onGenerate(prompt.trim())
      setPrompt('')
      onClose()
    } catch (error) {
      console.warn('Tool generation failed:', error)
      showToast(`Tool generation failed. ${error instanceof Error ? error.message : ''}`, 'error')
    }
  }

  const handleClose = () => {
    if (!isGenerating) {
      setPrompt('')
      onClose()
    }
  }

  const examplePrompts = [
    "Create a tool to search the web for information. It should accept a search query and optionally the number of results to return (1-10).",
    "Create a tool to translate text between languages. It should accept the text to translate, source language, and target language.",
    "Create a tool to generate QR codes. It should accept the text/URL to encode and optionally the size of the QR code.",
    "Create a tool to perform mathematical calculations. It should accept a mathematical expression as a string and return the result."
  ]

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="AI Tool Generator"
      size="lg"
      showCloseButton={!isGenerating}
    >
      <ModalBody>
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-purple-600">
            <Sparkles className="w-5 h-5" />
            <h3 className="font-medium">Generate Tool with AI</h3>
          </div>
          
          <p className="text-sm text-muted-foreground">
            Describe the tool you want to create. Be specific about its purpose, parameters, and expected behavior. 
            The AI will generate the tool name, description, and JSON schema for you.
          </p>

          <div className="space-y-2">
            <Label htmlFor="tool-prompt">Tool Description</Label>
            <Textarea
              id="tool-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the tool you want to create..."
              rows={6}
              disabled={isGenerating}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Example Prompts</Label>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {examplePrompts.map((example, index) => (
                <button
                  key={index}
                  onClick={() => setPrompt(example)}
                  disabled={isGenerating}
                  className="w-full text-left p-2 text-xs bg-muted/50 hover:bg-muted rounded border transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        </div>
      </ModalBody>
      
      <ModalFooter>
        <Button 
          variant="outline" 
          onClick={handleClose}
          disabled={isGenerating}
        >
          Cancel
        </Button>
        <Button 
          onClick={handleGenerate} 
          disabled={!prompt.trim() || isGenerating}
          className="flex items-center gap-2"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Generate Tool
            </>
          )}
        </Button>
      </ModalFooter>

      <ToastContainer />
    </Modal>
  )
}
