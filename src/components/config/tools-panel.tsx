'use client'

import React, { useState, forwardRef, useImperativeHandle, useMemo } from 'react'
import { APIConfig, Tool, ToolSchema } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { HttpRequestModal as HTTPRequestModal } from '@/components/modals'
import { ToolGeneratorModal } from '@/components/tools/tool-generator-modal'
import { ToolGenerator } from '@/lib/generators'
import { useSystemModel } from '@/hooks/use-system-model'
import { useRecentTags } from '@/hooks/use-recent-tags'
import { formatTimestamp } from '@/lib/utils'
import {
  Edit2,
  Trash2,
  Globe,
  Wrench as ToolIcon,
  Tag,
  X,
} from 'lucide-react'

// 最近使用的标签胶囊组件
interface RecentTagsPillsProps {
  recentTags: string[]
  onTagClick: (tag: string) => void
  onTagRemove: (tag: string) => void
}

function RecentTagsPills({ recentTags, onTagClick, onTagRemove }: RecentTagsPillsProps) {
  if (recentTags.length === 0) return null

  return (
    <div className="mt-2">
      <div className="flex flex-wrap gap-1">
        {recentTags.map((tag) => (
          <div
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-1 bg-muted hover:bg-muted/80 rounded-full text-xs cursor-pointer transition-colors"
          >
            <span onClick={() => onTagClick(tag)} className="hover:text-primary">
              {tag}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation()
                onTagRemove(tag)
              }}
              className="hover:text-red-500 transition-colors"
              title="Remove tag"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

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
  const { recentTags, addRecentTag, removeRecentTag } = useRecentTags()
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

  // Form data for create/edit
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    schema: '',
    tag: ''
  })
  const [schemaError, setSchemaError] = useState('')

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      schema: JSON.stringify({
        type: 'function',
        function: {
          name: '',
          description: '',
          parameters: {
            type: 'object',
            properties: {},
            required: []
          }
        }
      }, null, 2),
      tag: ''
    })
    setSchemaError('')
  }

  const handleCreate = () => {
    resetForm()
    setEditingTool(null)
    setShowCreateModal(true)
  }

  // 暴露方法给外部调用
  useImperativeHandle(ref, () => ({
    openCreateModal: handleCreate,
    openGeneratorModal: () => setShowGeneratorModal(true)
  }))

  const handleEdit = (tool: Tool) => {
    setEditingTool(tool)
    setFormData({
      name: tool.name,
      description: tool.description,
      schema: JSON.stringify(tool.schema, null, 2),
      tag: tool.tag || ''
    })
    setSchemaError('')
    setShowEditModal(true)
  }

  const validateSchema = (schemaStr: string): ToolSchema | null => {
    try {
      const parsed = JSON.parse(schemaStr)

      if (parsed.type !== 'function') {
        setSchemaError('Schema type must be "function"')
        return null
      }

      if (!parsed.function || !parsed.function.name || !parsed.function.description) {
        setSchemaError('Schema must have function.name and function.description')
        return null
      }

      if (!parsed.function.parameters || parsed.function.parameters.type !== 'object') {
        setSchemaError('Schema must have function.parameters with type "object"')
        return null
      }

      setSchemaError('')
      return parsed as ToolSchema
    } catch (e) {
      setSchemaError('Invalid JSON format')
      return null
    }
  }

  const handleSaveCreate = () => {
    if (!formData.name.trim() || !formData.description.trim()) {
      setSchemaError('Name and description are required')
      return
    }

    const schema = validateSchema(formData.schema)
    if (!schema) return

    // Update schema function name to match tool name
    schema.function.name = formData.name

    onToolCreate({
      id: `tool_${Date.now()}`,
      name: formData.name,
      description: formData.description,
      schema,
      tag: formData.tag || undefined,
      createdAt: Date.now(),
      updatedAt: Date.now()
    })

    // 添加标签到最近使用列表
    if (formData.tag && formData.tag.trim()) {
      addRecentTag(formData.tag.trim())
    }

    setShowCreateModal(false)
    resetForm()
  }

  const handleSaveEdit = () => {
    if (!formData.name.trim() || !formData.description.trim()) {
      setSchemaError('Name and description are required')
      return
    }

    const schema = validateSchema(formData.schema)
    if (!schema) return

    if (!editingTool) return

    // Update schema function name to match tool name
    schema.function.name = formData.name

    onToolUpdate({
      ...editingTool,
      name: formData.name,
      description: formData.description,
      schema,
      tag: formData.tag || undefined,
      updatedAt: Date.now()
    })

    // 添加标签到最近使用列表
    if (formData.tag && formData.tag.trim()) {
      addRecentTag(formData.tag.trim())
    }

    setShowEditModal(false)
    setEditingTool(null)
    resetForm()
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
      const generator = new ToolGenerator(systemModelConfig)
      const generatedTool = await generator.generateTool(prompt)

      // 填充到创建表单而不是直接创建
      setFormData({
        name: generatedTool.name,
        description: generatedTool.description,
        schema: JSON.stringify(generatedTool.schema, null, 2),
        tag: ''
      })
      setSchemaError('')
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
      const taggedTools = tools.filter(t => t.tag === tag).sort((a, b) => a.name.localeCompare(b.name))
      if (taggedTools.length > 0) {
        groups[tag] = taggedTools
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
                <SelectItem key={tag} value={tag}>{tag}</SelectItem>
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
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full mx-4 shadow-xl max-h-[90vh] flex flex-col">
            {/* Fixed Header */}
            <div className="flex justify-between items-center p-6 border-b">
              <h3 className="text-lg font-semibold">Create Tool</h3>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Form Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <Label htmlFor="create-name">Name</Label>
                <Input
                  id="create-name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Tool name"
                />
              </div>

              <div>
                <Label htmlFor="create-description">Description</Label>
                <Textarea
                  id="create-description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Tool description"
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="create-tag">Tag</Label>
                <Input
                  id="create-tag"
                  value={formData.tag}
                  onChange={(e) => setFormData(prev => ({ ...prev, tag: e.target.value }))}
                  placeholder="Enter tag name (optional)"
                />
                <RecentTagsPills
                  recentTags={recentTags}
                  onTagClick={(tag) => setFormData(prev => ({ ...prev, tag }))}
                  onTagRemove={removeRecentTag}
                />
              </div>

              <div>
                <Label htmlFor="create-schema">JSON Schema</Label>
                <Textarea
                  id="create-schema"
                  value={formData.schema}
                  onChange={(e) => setFormData(prev => ({ ...prev, schema: e.target.value }))}
                  placeholder="Tool JSON schema"
                  rows={12}
                  className="font-mono text-sm"
                />
                {schemaError && (
                  <p className="text-sm text-red-600 mt-1">{schemaError}</p>
                )}
              </div>
            </div>

            {/* Fixed Footer */}
            <div className="border-t p-6">
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveCreate}
                  disabled={!formData.name.trim() || !formData.description.trim()}
                >
                  Create Tool
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Tool Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full mx-4 shadow-xl max-h-[90vh] flex flex-col">
            {/* Fixed Header */}
            <div className="flex justify-between items-center p-6 border-b">
              <h3 className="text-lg font-semibold">Edit Tool</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Form Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Tool name"
                />
              </div>

              <div>
                <Label htmlFor="edit-description">Description</Label>
                <Textarea
                  id="edit-description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Tool description"
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="edit-tag">Tag</Label>
                <Input
                  id="edit-tag"
                  value={formData.tag}
                  onChange={(e) => setFormData(prev => ({ ...prev, tag: e.target.value }))}
                  placeholder="Enter tag name (optional)"
                />
                <RecentTagsPills
                  recentTags={recentTags}
                  onTagClick={(tag) => setFormData(prev => ({ ...prev, tag }))}
                  onTagRemove={removeRecentTag}
                />
              </div>

              <div>
                <Label htmlFor="edit-schema">JSON Schema</Label>
                <Textarea
                  id="edit-schema"
                  value={formData.schema}
                  onChange={(e) => setFormData(prev => ({ ...prev, schema: e.target.value }))}
                  placeholder="Tool JSON schema"
                  rows={12}
                  className="font-mono text-sm"
                />
                {schemaError && (
                  <p className="text-sm text-red-600 mt-1">{schemaError}</p>
                )}
              </div>
            </div>

            {/* Fixed Footer */}
            <div className="border-t p-6">
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setShowEditModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveEdit}
                  disabled={!formData.name.trim() || !formData.description.trim()}
                >
                  Update Tool
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

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
