'use client'

import React, { useState, useEffect } from 'react'
import { Agent, Tool } from '@/types'
import { Modal, ModalBody, ModalFooter } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Sparkles, Tag, Check, ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useSystemModel } from '@/hooks/use-system-model'
import { InstructionGenerator, ToolGenerator } from '@/lib/generators'
import { ToolFormModal } from '@/components/tools/tool-form-modal'
import { ToolGeneratorModal } from '@/components/tools/tool-generator-modal'

interface AgentFormModalProps {
  isOpen: boolean
  onClose: () => void
  agent?: Agent | null // undefined for create, Agent for edit
  tools: Tool[]
  onAgentCreate?: (agent: Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>
  onAgentUpdate?: (agentId: string, updates: Partial<Agent>) => void | Promise<void>
  onToolCreate?: (tool: Tool) => Promise<Tool> | Tool | void
}

export function AgentFormModal({
  isOpen,
  onClose,
  agent,
  tools,
  onAgentCreate,
  onAgentUpdate,
  onToolCreate
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
  const [selectedTag, setSelectedTag] = useState<string>('all')
  const [currentStep, setCurrentStep] = useState(1)
  const [showCreateToolModal, setShowCreateToolModal] = useState(false)
  const [showGeneratorModal, setShowGeneratorModal] = useState(false)
  const [isGeneratingTool, setIsGeneratingTool] = useState(false)
  const [generatedToolData, setGeneratedToolData] = useState<{
    name: string
    description: string
    schema: string
    tag: string
  } | null>(null)

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
        setCurrentStep(1) // Edit mode always starts at step 1
      } else {
        // Create mode: reset form
        resetForm()
        setCurrentStep(1) // Create mode starts at step 1
      }
    } else {
      resetForm()
      setCurrentStep(1)
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
    setCurrentStep(1)
  }

  const handleNext = () => {
    if (currentStep === 1 && !formData.name.trim()) {
      return // Don't proceed if name is empty
    }
    setCurrentStep(prev => Math.min(prev + 1, 2))
  }

  const handlePrev = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1))
  }

  const handleToolCreated = async (tool: Tool): Promise<Tool> => {
    let actualTool = tool
    if (onToolCreate) {
      // onToolCreate might return the actual tool with the real ID
      const result = await onToolCreate(tool)
      if (result && typeof result === 'object' && 'id' in result) {
        actualTool = result as Tool
      }
    }
    return actualTool
  }

  const handleToolSuccess = (tool: Tool) => {
    // Auto-select the newly created tool
    setFormData(prev => {
      // Check if tool is already selected to avoid duplicates
      if (prev.selectedTools.includes(tool.id)) {
        return prev
      }
      const newSelectedTools = [...prev.selectedTools, tool.id]
      return {
        ...prev,
        selectedTools: newSelectedTools
      }
    })
  }

  const handleGenerateTool = async (prompt: string) => {
    if (!hasSystemModel) {
      alert('Please configure System Model first')
      return
    }

    const systemModelConfig = getSystemModelConfig()
    if (!systemModelConfig) {
      alert('Please configure System Model first')
      return
    }

    setIsGeneratingTool(true)
    try {
      const generator = new ToolGenerator(systemModelConfig, systemModelConfig.provider)
      const generatedTool = await generator.generateTool(prompt)

      // Close generator modal and open create tool modal with generated data
      setShowGeneratorModal(false)
      setGeneratedToolData({
        name: generatedTool.name,
        description: generatedTool.description,
        schema: JSON.stringify(generatedTool.schema, null, 2),
        tag: ''
      })
      setShowCreateToolModal(true)
    } catch (error) {
      console.error('Tool generation failed:', error)
      alert(`Failed to generate tool: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsGeneratingTool(false)
    }
  }

  const handleSubmit = async () => {
    if (!formData.name.trim()) return

    try {
      if (isEditMode && agent && onAgentUpdate) {
        // Edit mode: only update name and description
        await onAgentUpdate(agent.id, {
          name: formData.name.trim(),
          description: formData.description.trim()
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

  // Progress steps
  const steps = [
    { number: 1, title: 'Name & Instruction', description: 'Basic information and system prompt' },
    { number: 2, title: 'Tools', description: 'Select tools for your agent' }
  ]

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={modalTitle}
        size={isEditMode ? "lg" : "xl"}
      >
        <ModalBody>
          <div className="space-y-6">
            {/* Progress Indicator - Only show in create mode */}
            {!isEditMode && (
              <div className="flex items-center justify-center space-x-4 mb-6">
                {steps.map((step, index) => (
                  <div key={step.number} className="flex items-center">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                      currentStep >= step.number
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {step.number}
                    </div>
                    <div className="ml-3 text-sm">
                      <div className={`font-medium ${currentStep >= step.number ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {step.title}
                      </div>
                      <div className="text-xs text-muted-foreground">{step.description}</div>
                    </div>
                    {index < steps.length - 1 && (
                      <div className={`w-12 h-px mx-4 ${currentStep > step.number ? 'bg-primary' : 'bg-muted'}`} />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Step Content */}
            {(isEditMode || currentStep === 1) && (
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

                {/* Instruction - Only show in create mode */}
                {!isEditMode && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label htmlFor="instruction">Instruction</Label>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => setShowAIPrompt(true)}
                        className="h-6 px-2 text-xs bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white hover:text-white border-none disabled:opacity-50"
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
                )}
              </div>
            )}

            {/* Step 2: Tools - Only show in create mode */}
            {!isEditMode && currentStep === 2 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Tools ({formData.selectedTools.length})</Label>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowCreateToolModal(true)}
                      className="flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Create Tool
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowGeneratorModal(true)}
                      disabled={!hasSystemModel}
                      className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white hover:text-white border-none disabled:opacity-50"
                    >
                      <Sparkles className="w-4 h-4" />
                      AI Generate
                    </Button>
                  </div>
                </div>
                <div className="mt-2 border border-border rounded-md overflow-hidden">
                <div className="flex h-64">
                  <div className="w-40 border-r bg-muted/30 p-3 overflow-y-auto">
                    <div className="space-y-1">
                      <button
                        type="button"
                        onClick={() => setSelectedTag('all')}
                        className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                          selectedTag === 'all'
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        All ({tools.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedTag('untagged')}
                        className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                          selectedTag === 'untagged'
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        Untagged ({tools.filter(t => !t.tag).length})
                      </button>
                      {(() => {
                        // 获取所有工具的标签并去重
                        const allTags = Array.from(new Set(
                          tools.map(t => t.tag).filter(Boolean)
                        )).sort()

                        return allTags.map(tag => {
                          const count = tools.filter(t => t.tag === tag).length
                          return (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => setSelectedTag(tag!)}
                              className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                                selectedTag === tag
                                  ? 'bg-primary text-primary-foreground'
                                  : 'text-muted-foreground hover:bg-muted'
                              }`}
                            >
                              <div className="flex items-center gap-1">
                                <Tag className="w-2.5 h-2.5" />
                                <span className="truncate">{tag} ({count})</span>
                              </div>
                            </button>
                          )
                        })
                      })()}
                    </div>
                  </div>

                  {/* 右侧：工具列表 */}
                  <div className="flex-1 p-3 overflow-y-auto">
                    {(() => {
                      const filteredTools = tools.filter(tool => {
                        if (selectedTag === 'all') return true
                        if (selectedTag === 'untagged') return !tool.tag
                        return tool.tag === selectedTag
                      }).sort((a, b) => a.name.localeCompare(b.name))

                      if (filteredTools.length === 0) {
                        return (
                          <p className="text-sm text-muted-foreground text-center py-8">
                            No tools in this category
                          </p>
                        )
                      }

                      return (
                        <div className="space-y-2">
                          {filteredTools.map((tool) => (
                            <label key={tool.id} className="flex items-start space-x-2 cursor-pointer p-2 rounded hover:bg-muted/50 transition-colors">
                              <input
                                type="checkbox"
                                checked={formData.selectedTools.includes(tool.id)}
                                onChange={() => handleToolToggle(tool.id)}
                                className="rounded border-border mt-0.5"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium">{tool.name}</span>
                                  {tool.tag && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs bg-muted text-muted-foreground">
                                      <Tag className="w-2.5 h-2.5" />
                                      {tool.tag}
                                    </span>
                                  )}
                                  {formData.selectedTools.includes(tool.id) && (
                                    <Check className="w-3 h-3 text-green-600" />
                                  )}
                                </div>
                                {tool.description && (
                                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{tool.description}</p>
                                )}
                              </div>
                            </label>
                          ))}
                        </div>
                      )
                    })()}
                  </div>
                </div>
              </div>
              </div>
            )}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>

          <div className="flex gap-2">
            {!isEditMode && currentStep > 1 && (
              <Button variant="outline" onClick={handlePrev}>
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>
            )}

            {!isEditMode && currentStep < 2 ? (
              <Button
                onClick={handleNext}
                disabled={!formData.name.trim()}
              >
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={!formData.name.trim() || isGenerating}
              >
                {submitButtonText}
              </Button>
            )}
          </div>
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
                  className="mt-2"
                  placeholder="e.g., customer support, data analysis, content writing..."
                  rows={6}
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

      {/* Create Tool Modal */}
      <ToolFormModal
        isOpen={showCreateToolModal}
        onClose={() => {
          setShowCreateToolModal(false)
          setGeneratedToolData(null)
        }}
        mode="create"
        onToolCreate={handleToolCreated}
        onSuccess={handleToolSuccess}
        initialData={generatedToolData || undefined}
      />

      {/* Tool Generator Modal */}
      <ToolGeneratorModal
        isOpen={showGeneratorModal}
        onClose={() => setShowGeneratorModal(false)}
        onGenerate={handleGenerateTool}
        isGenerating={isGeneratingTool}
      />
    </>
  )
}
