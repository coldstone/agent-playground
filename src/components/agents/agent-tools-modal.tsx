'use client'

import React, { useState, useEffect } from 'react'
import { Agent, Tool, Authorization, AgentToolBinding } from '@/types'
import { X, Wrench, Save, Check, Tag, Plus, Sparkles, Key } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CustomSelect } from '@/components/ui/custom-select'
import { Label } from '@/components/ui/label'
import { ToolFormModal } from '@/components/tools/tool-form-modal'
import { ToolGeneratorModal } from '@/components/tools/tool-generator-modal'
import { useSystemModel } from '@/hooks/use-system-model'
import { ToolGenerator } from '@/lib/generators'
import { migrateAgentTools, getAvailableAuthorizations, getEffectiveAuthorization } from '@/lib/authorization'
import { useToast } from '@/components/ui/toast'

interface AgentToolsModalProps {
  isOpen: boolean
  onClose: () => void
  agent: Agent | null
  allTools: Tool[]
  authorizations: Authorization[]
  onSave: (agentId: string, toolIds: string[]) => void
  onToolCreate?: (tool: Tool) => Promise<Tool> | Tool | void
}

export function AgentToolsModal({ isOpen, onClose, agent, allTools, authorizations, onSave, onToolCreate }: AgentToolsModalProps) {
  const { hasSystemModel, getSystemModelConfig } = useSystemModel()
  const { showToast, ToastContainer } = useToast()
  const [toolBindings, setToolBindings] = useState<AgentToolBinding[]>([])
  const [initialToolBindings, setInitialToolBindings] = useState<AgentToolBinding[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [selectedTag, setSelectedTag] = useState<string>('all')
  const [showCreateToolModal, setShowCreateToolModal] = useState(false)
  const [showGeneratorModal, setShowGeneratorModal] = useState(false)
  const [isGeneratingTool, setIsGeneratingTool] = useState(false)
  const [generatedToolData, setGeneratedToolData] = useState<{
    name: string
    description: string
    schema: string
    tag: string
  } | null>(null)

  // Reset tool bindings when modal opens or agent changes
  useEffect(() => {
    if (isOpen && agent) {
      const initialBindings = migrateAgentTools(agent)
      setToolBindings(initialBindings)
      setInitialToolBindings(initialBindings)
    }
  }, [isOpen, agent])

  const handleToolToggle = (toolId: string) => {
    setToolBindings(prev => {
      const existingIndex = prev.findIndex(binding => binding.toolId === toolId)
      
      if (existingIndex >= 0) {
        // Remove tool if it exists
        return prev.filter((_, index) => index !== existingIndex)
      } else {
        // Add tool with no authorization selected by default
        const newBinding: AgentToolBinding = {
          toolId,
          authorizationId: undefined
        }
        return [...prev, newBinding]
      }
    })
  }

  const handleAuthorizationChange = (toolId: string, authorizationId: string | undefined) => {
    setToolBindings(prev => 
      prev.map(binding =>
        binding.toolId === toolId
          ? { ...binding, authorizationId: authorizationId || undefined }
          : binding
      )
    )
  }

  const handleSave = async () => {
    if (!agent) return
    
    setIsSaving(true)
    try {
      // For now, just pass tool IDs for backward compatibility
      // TODO: Update onSave to accept toolBindings
      await onSave(agent.id, toolBindings.map(binding => binding.toolId))
      onClose()
    } catch (error) {
      console.error('Failed to save tools:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    if (agent) {
      setToolBindings(migrateAgentTools(agent))
    }
    onClose()
  }

  const handleToolCreate = async (tool: Tool): Promise<Tool> => {
    if (onToolCreate) {
      const result = await onToolCreate(tool)
      if (result && typeof result === 'object' && 'id' in result) {
        setShowCreateToolModal(false)
        return result as Tool
      }
    }
    setShowCreateToolModal(false)
    return tool
  }

  const handleToolSuccess = (tool: Tool) => {
    // Auto-select the newly created tool
    setToolBindings(prev => {
      // Check if tool is already selected to avoid duplicates
      if (prev.some(binding => binding.toolId === tool.id)) {
        return prev
      }
      const newBinding: AgentToolBinding = {
        toolId: tool.id,
        authorizationId: undefined
      }
      return [...prev, newBinding]
    })
  }

  const handleGenerateTool = async (prompt: string) => {
    if (!hasSystemModel) {
      showToast('Please configure System Model first', 'error')
      return
    }

    const systemModelConfig = getSystemModelConfig()
    if (!systemModelConfig) {
      showToast('Please configure System Model first', 'error')
      return
    }

    setIsGeneratingTool(true)
    try {
      const generator = new ToolGenerator(systemModelConfig, systemModelConfig.provider)
      const generatedTool = await generator.generateTool(prompt)

      // 填充到创建表单而不是直接创建
      setGeneratedToolData({
        name: generatedTool.name,
        description: generatedTool.description,
        schema: JSON.stringify(generatedTool.schema, null, 2),
        tag: ''
      })

      // 关闭生成器模态框，打开创建模态框
      setShowGeneratorModal(false)
      setShowCreateToolModal(true)
    } catch (error) {
      console.error('Tool generation failed:', error)
      showToast(`Failed to generate tool: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
    } finally {
      setIsGeneratingTool(false)
    }
  }



  if (!isOpen || !agent) return null

  const selectedCount = toolBindings.length

  // 过滤工具
  const filteredTools = allTools.filter(tool => {
    if (selectedTag === 'all') return true
    if (selectedTag === 'untagged') return !tool.tag
    return tool.tag === selectedTag
  })

  // 过滤工具
  const filteredTools = allTools.filter(tool => {
    if (selectedTag === 'all') return true
    if (selectedTag === 'untagged') return !tool.tag
    return tool.tag === selectedTag
  })

  // 排序逻辑：已保存的工具在顶部，其他工具按名称排序
  const sortedTools = [...filteredTools].sort((a, b) => {
    const aWasInitiallySelected = initialToolBindings.some(binding => binding.toolId === a.id)
    const bWasInitiallySelected = initialToolBindings.some(binding => binding.toolId === b.id)

    // 如果一个是初始选中的，另一个不是，初始选中的排在前面
    if (aWasInitiallySelected && !bWasInitiallySelected) return -1
    if (!aWasInitiallySelected && bWasInitiallySelected) return 1

    // 如果都是初始选中的，或者都不是初始选中的，按名称排序
    return a.name.localeCompare(b.name)
  })

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Wrench className="w-5 h-5" />
            Manage Tools - {agent.name}
          </h2>
          <div className="flex items-center gap-2">
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
            <button
              onClick={handleCancel}
              className="text-gray-400 hover:text-gray-600 transition-colors ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex h-[60vh]">
          {/* 左侧：标签分类 */}
          <div className="w-48 border-r bg-gray-50 p-4 overflow-y-auto">
            <h3 className="font-medium text-gray-900 mb-3">Categories</h3>
            <div className="space-y-1">
              <button
                onClick={() => setSelectedTag('all')}
                className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                  selectedTag === 'all'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                All Tools ({allTools.length})
              </button>
              <button
                onClick={() => setSelectedTag('untagged')}
                className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                  selectedTag === 'untagged'
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                Untagged ({allTools.filter(t => !t.tag).length})
              </button>
              {(() => {
                // 获取所有工具的标签并去重
                const allTags = Array.from(new Set(
                  allTools.map(t => t.tag).filter(Boolean)
                )).sort()

                return allTags.map(tag => {
                  const count = allTools.filter(t => t.tag === tag).length
                  return (
                    <button
                      key={tag}
                      onClick={() => setSelectedTag(tag!)}
                      className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
                        selectedTag === tag
                          ? 'bg-blue-100 text-blue-700'
                          : 'text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Tag className="w-3 h-3" />
                        <span>{tag} ({count})</span>
                      </div>
                    </button>
                  )
                })
              })()}
            </div>
          </div>

          {/* 右侧：工具列表 */}
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="mb-4">
              <p className="text-sm text-gray-600 mb-3">
                Select the tools that this agent can use. Tools provide additional capabilities like API calls, data processing, and external integrations.
              </p>
            </div>

            {filteredTools.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Wrench className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No tools in this category</p>
                <p className="text-sm">Try selecting a different category or create new tools</p>
              </div>
            ) : (
              <div className="space-y-4">
                {sortedTools.map(tool => {
                  const isSelected = toolBindings.some(binding => binding.toolId === tool.id)
                  const binding = toolBindings.find(binding => binding.toolId === tool.id)
                  const availableAuths = getAvailableAuthorizations(tool, authorizations)
                  const effectiveAuth = binding ? getEffectiveAuthorization(tool, authorizations, binding) : null
                  
                  return (
                    <div key={tool.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                      {/* Tool Selection */}
                      <label className="flex items-start gap-3 cursor-pointer">
                        <div className="flex items-center h-5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToolToggle(tool.id)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                        </div>
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <div className="flex items-center gap-2 min-w-0">
                            <h3 className="font-medium text-gray-900 truncate">{tool.name}</h3>
                            {tool.tag && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600 flex-shrink-0">
                                <Tag className="w-3 h-3" />
                                {tool.tag}
                              </span>
                            )}
                            {isSelected && (
                              <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-sm text-gray-600 mt-1 line-clamp-2">{tool.description}</p>
                          {tool.httpRequest && (
                            <div className="text-xs text-blue-600 mt-1 flex items-center gap-1 min-w-0">
                              <span className="font-medium flex-shrink-0">{tool.httpRequest.method}</span>
                              <span className="truncate min-w-0" title={tool.httpRequest.url}>
                                {tool.httpRequest.url}
                              </span>
                            </div>
                          )}
                        </div>
                      </label>

                      {/* Authorization Selection */}
                      {isSelected && (
                        <div className="ml-7 pl-4 border-l-2 border-gray-200 space-y-2">
                          <div className="flex items-center gap-2">
                            <Key className="w-4 h-4 text-gray-500" />
                            <Label className="text-sm font-medium">Authorization</Label>
                          </div>
                          <CustomSelect
                            value={binding?.authorizationId || ''}
                            onChange={(value) => handleAuthorizationChange(tool.id, value || undefined)}
                            options={[
                              { value: '', label: 'Use Default' },
                              ...availableAuths.map(auth => ({
                                value: auth.id,
                                label: `${auth.name}${auth.isDefaultInTag && (auth.tag === tool.tag || (!auth.tag && !tool.tag)) ? ' (Default)' : ''}`
                              }))
                            ]}
                            placeholder="Select authorization"
                            size="sm"
                          />
                          {effectiveAuth && (
                            <p className="text-xs text-gray-500">
                              Using: <span className="font-medium">{effectiveAuth.name}</span>
                              {effectiveAuth !== authorizations.find(a => a.id === binding?.authorizationId) && (
                                <span className="text-blue-600"> (Auto-selected)</span>
                              )}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between p-6 border-t bg-gray-50">
          <div className="text-sm text-gray-600 flex items-center">
            Selected: {selectedCount} tool{selectedCount !== 1 ? 's' : ''}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors flex items-center"
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

      {/* Create Tool Modal */}
      <ToolFormModal
        isOpen={showCreateToolModal}
        onClose={() => {
          setShowCreateToolModal(false)
          setGeneratedToolData(null)
        }}
        mode="create"
        onToolCreate={handleToolCreate}
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
      <ToastContainer />
    </div>
  )
}
