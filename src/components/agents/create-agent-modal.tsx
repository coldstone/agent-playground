'use client'

import React, { useState, useEffect } from 'react'
import { Agent, Tool } from '@/types'
import { Modal, ModalBody, ModalFooter } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Sparkles, X } from 'lucide-react'

interface CreateAgentModalProps {
  isOpen: boolean
  onClose: () => void
  tools: Tool[]
  onAgentCreate: (agent: Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string> // Return the created agent ID
}

interface AIPromptModalProps {
  isOpen: boolean
  onClose: () => void
  onGenerate: (prompt: string) => void
  currentInstruction: string
}

function AIPromptModal({ isOpen, onClose, onGenerate, currentInstruction }: AIPromptModalProps) {
  const [prompt, setPrompt] = useState('')

  const handleGenerate = () => {
    if (prompt.trim()) {
      onGenerate(prompt)
      setPrompt('')
      onClose()
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="AI Generate Instruction">
      <ModalBody>
        <div className="space-y-4">
          {currentInstruction.length > 50 && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md">
              <p className="text-sm text-yellow-800">
                Warning: The current instruction will be overwritten by the AI-generated content.
              </p>
            </div>
          )}
          <div>
            <Label htmlFor="ai-prompt">Describe what you want the agent to do:</Label>
            <Textarea
              id="ai-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., Create a helpful coding assistant that can help with JavaScript and React development..."
              className="mt-1"
              rows={4}
            />
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleGenerate} disabled={!prompt.trim()}>
          <Sparkles className="w-4 h-4 mr-2" />
          Generate
        </Button>
      </ModalFooter>
    </Modal>
  )
}

export function CreateAgentModal({
  isOpen,
  onClose,
  tools,
  onAgentCreate
}: CreateAgentModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    systemPrompt: '',
    selectedTools: [] as string[]
  })
  const [showAIPrompt, setShowAIPrompt] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      resetForm()
    }
  }, [isOpen])

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      systemPrompt: '',
      selectedTools: []
    })
  }

  const handleSubmit = async () => {
    if (!formData.name.trim()) return

    const createdAgentId = await onAgentCreate({
      name: formData.name.trim(),
      description: formData.description.trim(),
      systemPrompt: formData.systemPrompt.trim(),
      tools: formData.selectedTools
    })

    onClose()
    return createdAgentId
  }

  const handleAIGenerate = async (prompt: string) => {
    setIsGenerating(true)
    try {
      // Simulate AI generation with typing effect
      const generatedInstruction = `You are a helpful AI assistant specialized in ${prompt}. Your role is to provide accurate, helpful, and detailed responses while maintaining a professional and friendly tone. Always strive to understand the user's needs and provide the most relevant information or assistance.`
      
      // Clear current instruction
      setFormData(prev => ({ ...prev, systemPrompt: '' }))
      
      // Simulate typing effect
      let currentText = ''
      for (let i = 0; i < generatedInstruction.length; i++) {
        currentText += generatedInstruction[i]
        setFormData(prev => ({ ...prev, systemPrompt: currentText }))
        await new Promise(resolve => setTimeout(resolve, 20))
      }
    } catch (error) {
      console.error('Failed to generate instruction:', error)
    } finally {
      setIsGenerating(false)
    }
  }

  const toggleTool = (toolId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedTools: prev.selectedTools.includes(toolId)
        ? prev.selectedTools.filter(id => id !== toolId)
        : [...prev.selectedTools, toolId]
    }))
  }

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title="Create New Agent">
        <ModalBody>
          <div className="space-y-4">
            <div>
              <Label htmlFor="agent-name">Name *</Label>
              <Input
                id="agent-name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter agent name"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="agent-description">Description</Label>
              <Input
                id="agent-description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of the agent"
                className="mt-1"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label htmlFor="agent-instruction">Instruction</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAIPrompt(true)}
                  disabled={isGenerating}
                  className="h-6 px-2 text-xs"
                >
                  <Sparkles className="w-3 h-3 mr-1" />
                  AI Generate
                </Button>
              </div>
              <Textarea
                id="agent-instruction"
                value={formData.systemPrompt}
                onChange={(e) => setFormData(prev => ({ ...prev, systemPrompt: e.target.value }))}
                placeholder="System prompt for the agent..."
                className="mt-1"
                rows={4}
                disabled={isGenerating}
              />
            </div>

            <div>
              <Label>Tools</Label>
              <div className="mt-2 space-y-2 max-h-32 overflow-y-auto">
                {tools.map((tool) => (
                  <label key={tool.id} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.selectedTools.includes(tool.id)}
                      onChange={() => toggleTool(tool.id)}
                      className="rounded border-gray-300"
                    />
                    <span className="text-sm">{tool.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!formData.name.trim() || isGenerating}>
            Create Agent
          </Button>
        </ModalFooter>
      </Modal>

      <AIPromptModal
        isOpen={showAIPrompt}
        onClose={() => setShowAIPrompt(false)}
        onGenerate={handleAIGenerate}
        currentInstruction={formData.systemPrompt}
      />
    </>
  )
}
