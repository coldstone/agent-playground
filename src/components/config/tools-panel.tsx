'use client'

import React, { useState, forwardRef, useImperativeHandle, useMemo } from 'react'
import { APIConfig, Tool } from '@/types'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { HttpRequestModal as HTTPRequestModal } from '@/components/modals'
import { ToolGeneratorModal } from '@/components/tools/tool-generator-modal'
import { ToolFormModal } from '@/components/tools/tool-form-modal'
import { ToolGenerator } from '@/lib/generators'
import { useSystemModel } from '@/hooks/use-system-model'

import { formatTimestamp } from '@/lib/utils'
import {
  Edit2,
  Trash2,
  Globe,
  Wrench as ToolIcon,
  Tag,
} from 'lucide-react'

interface ToolsPanelProps {
  tools: Tool[]
  config: APIConfig
  onToolCreate: (tool: Tool) => void
  onToolUpdate: (tool: Tool) => void
  onToolDelete: (toolId: string) => void
}

export interface ToolsPanelRef {
  openCreateModal: () => void
  openGeneratorModal: () => void
}

export const ToolsPanel = forwardRef<ToolsPanelRef, ToolsPanelProps>(({
  tools,
  config,
  onToolCreate,
  onToolUpdate,
  onToolDelete
}, ref) => {
  const { hasSystemModel, getSystemModelConfig } = useSystemModel()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showGeneratorModal, setShowGeneratorModal] = useState(false)
  const [showHttpRequestModal, setShowHttpRequestModal] = useState(false)
  const [httpRequestTool, setHttpRequestTool] = useState<Tool | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [toolToDelete, setToolToDelete] = useState<Tool | null>(null)
  const [editingTool, setEditingTool] = useState<Tool | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [selectedTag, setSelectedTag] = useState<string>('all')
  const [generatedToolData, setGeneratedToolData] = useState<{
    name: string
    description: string
    schema: string
    tag: string
  } | null>(null)

  const handleCreate = () => {
    setEditingTool(null)
    setGeneratedToolData(null)
    setShowCreateModal(true)
  }

  // 暴露方法给外部调用
  useImperativeHandle(ref, () => ({
    openCreateModal: handleCreate,
    openGeneratorModal: () => setShowGeneratorModal(true)
  }))

  const handleEdit = (tool: Tool) => {
    setEditingTool(tool)
    setShowEditModal(true)
  }

  const handleToolCreate = (tool: Tool) => {
    onToolCreate(tool)
    setShowCreateModal(false)
  }

  const handleToolUpdate = (tool: Tool) => {
    onToolUpdate(tool)
    setShowEditModal(false)
    setEditingTool(null)
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

    setIsGenerating(true)
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
      setEditingTool(null)

      // 关闭生成器模态框，打开创建模态框
      setShowGeneratorModal(false)
      setShowCreateModal(true)
    } catch (error) {
      console.error('Tool generation failed:', error)
      alert(`Failed to generate tool: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsGenerating(false)
    }
  }



  const handleHttpRequestConfig = (tool: Tool) => {
    setHttpRequestTool(tool)
    setShowHttpRequestModal(true)
  }

  const handleSaveHttpRequest = (config: any) => {
    if (httpRequestTool) {
      onToolUpdate({
        ...httpRequestTool,
        httpRequest: config,
        updatedAt: Date.now()
      })
    }
    setShowHttpRequestModal(false)
    setHttpRequestTool(null)
  }

  const handleDeleteClick = (tool: Tool) => {
    setToolToDelete(tool)
    setShowDeleteConfirm(true)
  }

  const handleDeleteConfirm = () => {
    if (toolToDelete) {
      onToolDelete(toolToDelete.id)
    }
    setShowDeleteConfirm(false)
    setToolToDelete(null)
  }

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false)
    setToolToDelete(null)
  }



  // 按标签分组工具
  const groupedTools = useMemo(() => {
    if (selectedTag !== 'all') {
      // 如果选择了特定标签，只显示该标签下的工具
      const filteredTools = tools.filter(tool => {
        if (selectedTag === 'untagged') return !tool.tag
        return tool.tag === selectedTag
      })
      return { [selectedTag]: filteredTools.sort((a, b) => a.name.localeCompare(b.name)) }
    }

    // 显示所有工具，按标签分组（不包含All组）
    const groups: Record<string, Tool[]> = {}

    // 获取所有唯一标签并排序
    const allTags = Array.from(new Set(tools.map(t => t.tag).filter(Boolean))).sort()

    // Untagged 组
    const untaggedTools = tools.filter(t => !t.tag).sort((a, b) => a.name.localeCompare(b.name))
    if (untaggedTools.length > 0) {
      groups['Untagged'] = untaggedTools
    }

    // 各个标签组
    allTags.forEach(tag => {
      if (tag) {
        const taggedTools = tools.filter(t => t.tag === tag).sort((a, b) => a.name.localeCompare(b.name))
        if (taggedTools.length > 0) {
          groups[tag] = taggedTools
        }
      }
    })

    return groups
  }, [tools, selectedTag])

  return (
    <>
      <div className="space-y-3">
        {/* 标签过滤器 */}
        <div className="flex gap-2">
          <Select value={selectedTag} onValueChange={setSelectedTag}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Filter by tag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tools</SelectItem>
              <SelectItem value="untagged">Untagged</SelectItem>
              {Array.from(new Set(tools.map(t => t.tag).filter(Boolean))).sort().map(tag => (
                <SelectItem key={tag} value={tag!}>{tag}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {tools.length === 0 ? (
          <div className="flex items-center justify-center text-center text-muted-foreground py-8">
            <div>
              <ToolIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No tools created yet</p>
              <p className="text-xs">Create tools to enable agent functionality</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(groupedTools).map(([groupName, groupTools]) => {
              if (groupTools.length === 0) return null

              return (
                <div key={groupName}>
                  {/* 显示分组标题 */}
                  <div className="text-xs text-muted-foreground font-medium mb-2">
                    {groupName} ({groupTools.length})
                  </div>
                  <div className="space-y-3">
                    {groupTools.map((tool) => (
                      <div
                        key={tool.id}
                        className="group p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex flex-col gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <h5 className="font-medium text-sm">{tool.name}</h5>
                              {tool.tag && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-muted text-muted-foreground">
                                  <Tag className="w-3 h-3" />
                                  {tool.tag}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {tool.description}
                            </p>
                            {tool.httpRequest && (
                              <div className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                                <Globe className="w-3 h-3 flex-shrink-0" />
                                <span className="font-mono">{tool.httpRequest.method}</span>
                                <span className="truncate">{tool.httpRequest.url}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="text-xs text-muted-foreground">
                              {formatTimestamp(tool.updatedAt)}
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => handleHttpRequestConfig(tool)}
                                className="h-5 w-5 flex items-center justify-center hover:bg-muted rounded transition-colors"
                                title="Configure HTTP Request"
                              >
                                <Globe className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleEdit(tool)}
                                className="h-5 w-5 flex items-center justify-center hover:bg-muted rounded transition-colors"
                                title="Edit Tool"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleDeleteClick(tool)}
                                className="h-5 w-5 flex items-center justify-center hover:bg-red-100 text-red-600 hover:text-red-700 rounded transition-colors"
                                title="Delete Tool"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Create Tool Modal */}
      <ToolFormModal
        isOpen={showCreateModal}
        onClose={() => {
          setShowCreateModal(false)
          setGeneratedToolData(null)
        }}
        mode="create"
        onToolCreate={handleToolCreate}
        initialData={generatedToolData || undefined}
      />

      {/* Edit Tool Modal */}
      <ToolFormModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false)
          setEditingTool(null)
        }}
        mode="edit"
        tool={editingTool || undefined}
        onToolUpdate={handleToolUpdate}
      />

      {/* Tool Generator Modal */}
      <ToolGeneratorModal
        isOpen={showGeneratorModal}
        onClose={() => setShowGeneratorModal(false)}
        onGenerate={handleGenerateTool}
        isGenerating={isGenerating}
      />

      <HTTPRequestModal
        isOpen={showHttpRequestModal}
        onClose={() => setShowHttpRequestModal(false)}
        config={httpRequestTool?.httpRequest}
        onSave={handleSaveHttpRequest}
      />

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold mb-2">Delete Tool</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete "{toolToDelete?.name}"? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={handleDeleteCancel}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteConfirm}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
})
