'use client'

import React, { useState, useEffect } from 'react'
import { Agent, Tool } from '@/types'
import { Modal, ModalBody, ModalFooter } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Sparkles } from 'lucide-react'
import { useSystemModel } from '@/hooks/use-system-model'
import { InstructionGenerator } from '@/lib/generators'

interface AgentFormModalProps {
  isOpen: boolean
  onClose: () => void
  agent?: Agent | null // undefined for create, Agent for edit
  tools: Tool[]
  onAgentCreate?: (agent: Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>
  onAgentUpdate?: (agentId: string, updates: Partial<Agent>) => void | Promise<void>
}

export function AgentFormModal({
  isOpen,
  onClose,
  agent,
  tools,
  onAgentCreate,
  onAgentUpdate
}: AgentFormModalProps) {
  const { hasSystemModel, getSystemModelConfig } = useSystemModel()
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    systemPrompt: '',
    selectedTools: [] as string[]
  })
  const [showAIPrompt, setShowAIPrompt] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)

  const isEditMode = !!agent
  const modalTitle = isEditMode ? 'Edit Agent' : 'Create New Agent'
  const submitButtonText = isEditMode ? 'Update Agent' : 'Create Agent'

  useEffect(() => {
    if (isOpen) {
      if (isEditMode && agent) {
        // Edit mode: populate with existing agent data
        setFormData({
          name: agent.name,
          description: agent.description,
          systemPrompt: agent.systemPrompt,
          selectedTools: agent.tools || []
        })
      } else {
        // Create mode: reset form
        resetForm()
      }
    } else {
      resetForm()
    }
  }, [isOpen, agent, isEditMode])

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      systemPrompt: '',
      selectedTools: []
    })
    setShowAIPrompt(false)
    setAiPrompt('')
    setIsGenerating(false)
  }

  const handleSubmit = async () => {
    if (!formData.name.trim()) return

    try {
      if (isEditMode && agent && onAgentUpdate) {
        // Edit mode
        await onAgentUpdate(agent.id, {
          name: formData.name.trim(),
          description: formData.description.trim(),
          systemPrompt: formData.systemPrompt.trim(),
          tools: formData.selectedTools
        })
      } else if (!isEditMode && onAgentCreate) {
        // Create mode
        await onAgentCreate({
          name: formData.name.trim(),
          description: formData.description.trim(),
          systemPrompt: formData.systemPrompt.trim(),
          tools: formData.selectedTools
        })
      }
      onClose()
    } catch (error) {
      console.error(`Failed to ${isEditMode ? 'update' : 'create'} agent:`, error)
    }
  }

  const handleAIGenerate = async (prompt: string) => {
    if (!hasSystemModel) {
      alert('Please configure System Model first')
      return
    }

    const systemModelConfig = getSystemModelConfig()
    if (!systemModelConfig) {
      alert('Please configure System Model first')
      return
    }

    setIsGenerating(true)

    try {
      // Check if current content is long and ask for confirmation
      if (formData.systemPrompt.length > 50) {
        const shouldOverwrite = window.confirm('This will overwrite the existing instruction. Continue?')
        if (!shouldOverwrite) {
          setIsGenerating(false)
          setShowAIPrompt(false)
          return
        }
      }

      // Clear current content
      setFormData(prev => ({ ...prev, systemPrompt: '' }))

      const generator = new InstructionGenerator(systemModelConfig, systemModelConfig.provider)

      let generatedContent = ''
      for await (const chunk of generator.generateInstruction(prompt)) {
        generatedContent += chunk
        // Real-time update with typing effect
        setFormData(prev => ({ ...prev, systemPrompt: generatedContent }))
      }

      if (generatedContent.trim()) {
        // Close AI generator after completion
        setShowAIPrompt(false)
        setAiPrompt('')
      }
    } catch (error) {
      console.error('Failed to generate instruction:', error)
      alert('Failed to generate instruction. Please try again.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleToolToggle = (toolId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedTools: prev.selectedTools.includes(toolId)
        ? prev.selectedTools.filter(id => id !== toolId)
        : [...prev.selectedTools, toolId]
    }))
  }

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={modalTitle}>
        <ModalBody>
          <div className="space-y-4">
            {/* Name */}
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter agent name"
              />
            </div>

            {/* Description */}
            <div>
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of the agent"
              />
            </div>

            {/* Instruction */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label htmlFor="instruction">Instruction</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAIPrompt(true)}
                  className="h-6 px-2 text-xs"
                  disabled={isGenerating || !hasSystemModel}
                >
                  <Sparkles className="w-3 h-3 mr-1" />
                  AI Generate
                </Button>
              </div>
              <Textarea
                id="instruction"
                value={formData.systemPrompt}
                onChange={(e) => setFormData(prev => ({ ...prev, systemPrompt: e.target.value }))}
                placeholder="System prompt for the agent..."
                rows={6}
                disabled={isGenerating}
              />
            </div>

            {/* Tools */}
            <div>
              <Label>Tools</Label>
              <div className="mt-2 space-y-2 max-h-40 overflow-y-auto border border-border rounded-md p-3">
                {tools.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No tools available</p>
                ) : (
                  tools.map((tool) => (
                    <label key={tool.id} className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.selectedTools.includes(tool.id)}
                        onChange={() => handleToolToggle(tool.id)}
                        className="rounded border-border"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium">{tool.name}</span>
                        {tool.description && (
                          <p className="text-xs text-muted-foreground truncate">{tool.description}</p>
                        )}
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!formData.name.trim() || isGenerating}>
            {submitButtonText}
          </Button>
        </ModalFooter>
      </Modal>

      {/* AI Prompt Modal */}
      {showAIPrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-background rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-4">Generate Agent Instruction</h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="ai-prompt">What should this agent help with?</Label>
                <Textarea
                  id="ai-prompt"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="e.g., customer support, data analysis, content writing..."
                  rows={3}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAIPrompt(false)
                    setAiPrompt('')
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => handleAIGenerate(aiPrompt)}
                  disabled={!aiPrompt.trim() || isGenerating || !hasSystemModel}
                >
                  {isGenerating ? 'Generating...' : 'Generate'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
