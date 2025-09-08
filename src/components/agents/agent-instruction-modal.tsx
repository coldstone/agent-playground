'use client'

import React, { useState, useEffect } from 'react'
import { Agent, APIConfig } from '@/types'
import { X, BookUser, Save, Sparkles, Wand2 } from 'lucide-react'
import { InstructionGenerator } from '@/lib/generators'
import { useSystemModel } from '@/hooks/use-system-model'
import { useToast } from '@/components/ui/toast'

interface AgentInstructionModalProps {
  isOpen: boolean
  onClose: () => void
  agent: Agent | null
  onSave: (agentId: string, instruction: string) => void
  apiConfig?: APIConfig
}

export function AgentInstructionModal({ isOpen, onClose, agent, onSave, apiConfig }: AgentInstructionModalProps) {
  const { hasSystemModel, getSystemModelConfig } = useSystemModel()
  const { showToast, ToastContainer } = useToast()
  const [instruction, setInstruction] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [showAIGenerator, setShowAIGenerator] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)

  // Reset instruction when modal opens or agent changes
  useEffect(() => {
    if (isOpen && agent) {
      setInstruction(agent.systemPrompt || '')
    }
  }, [isOpen, agent])

  const handleSave = async () => {
    if (!agent) return
    
    setIsSaving(true)
    try {
      await onSave(agent.id, instruction)
      onClose()
    } catch (error) {
      console.error('Failed to save instruction:', error)
      showToast('Failed to save instruction. ', 'error')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setInstruction(agent?.systemPrompt || '')
    setShowAIGenerator(false)
    setAiPrompt('')
    onClose()
  }

  const handleGenerateInstruction = async () => {
    if (!aiPrompt.trim() || !hasSystemModel) {
      return
    }

    const systemModelConfig = getSystemModelConfig()
    if (!systemModelConfig) {
      showToast('Please configure System Model first', 'error')
      return
    }

    setIsGenerating(true)
    setInstruction('')

    try {
      const generator = new InstructionGenerator(systemModelConfig, systemModelConfig.provider)

      let generatedContent = ''
      for await (const chunk of generator.generateInstruction(aiPrompt)) {
        generatedContent += chunk
        setInstruction(generatedContent)
      }

      if (generatedContent.trim()) {
        setShowAIGenerator(false)
        setAiPrompt('')
      }
    } catch (error) {
      console.error('Failed to generate instruction:', error)
      showToast('Failed to generate instruction.', 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  if (!isOpen || !agent) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-background border border-border rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <BookUser className="w-5 h-5" />
            Edit Instruction - {agent.name}
          </h2>
          <button
            onClick={handleCancel}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="space-y-4">
            {/* AI Generator Section */}
            {!showAIGenerator ? (
              <div className="flex items-center justify-between mb-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Agent Instruction
                  </label>
                  <p className="text-sm text-muted-foreground">
                    Define how this agent should behave and respond to user messages.
                  </p>
                </div>
                {hasSystemModel && (
                  <button
                    onClick={() => setShowAIGenerator(true)}
                    className="flex items-center gap-2 px-3 py-2 text-sm bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-md transition-all"
                    disabled={!hasSystemModel}
                  >
                    <Sparkles className="w-4 h-4" />
                    AI Generate
                  </button>
                )}
              </div>
            ) : (
              <div className="bg-muted border border-border rounded-lg p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Wand2 className="w-5 h-5 text-purple-600" />
                    <h3 className="font-medium text-foreground">AI Instruction Generator</h3>
                  </div>
                  <button
                    onClick={() => {
                      setShowAIGenerator(false)
                      setAiPrompt('')
                    }}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Describe your agent
                  </label>
                  <p className="text-sm text-muted-foreground mb-2">
                  Tell us what you want your agent to do, its personality, expertise, as well as the tools and workflows it can utilize.
                  </p>
                  <textarea
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="Example: A helpful customer service agent that is friendly, professional, and knowledgeable about our products. It should always ask clarifying questions and provide detailed solutions."
                    className="w-full h-24 px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent resize-none bg-card text-foreground placeholder:text-muted-foreground"
                  />
                </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleGenerateInstruction}
                      disabled={!aiPrompt.trim() || isGenerating || !hasSystemModel}
                      className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      {isGenerating ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          Generate Instruction
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => {
                        setShowAIGenerator(false)
                        setAiPrompt('')
                      }}
                      className="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Instruction Textarea */}
            <div className="relative">
              <textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="You are a helpful AI assistant with access to tools. When you need to use a tool, call the appropriate function with the required parameters."
              className={`w-full h-64 px-3 py-2 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent resize-none bg-card text-foreground placeholder:text-muted-foreground ${
                isGenerating ? 'opacity-80' : ''
              }`}
              disabled={isGenerating}
            />
              {/* 生成状态指示器 */}
              {isGenerating && (
                <div className="absolute top-3 right-3 flex items-center gap-2 bg-card/95 backdrop-blur-sm px-3 py-2 rounded-md text-sm text-muted-foreground border border-border shadow-sm">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                  <span className="font-medium">AI Generating...</span>
                </div>
              )}
            </div>

            <div className="text-sm text-muted-foreground">
              Character count: {instruction.length}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between p-6 border-t border-border bg-muted">
          <div className="text-sm text-muted-foreground">
            Changes will be saved to the agent configuration
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
      <ToastContainer />
    </div>
  )
}
