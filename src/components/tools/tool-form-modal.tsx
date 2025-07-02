'use client'

import React, { useState, useEffect } from 'react'
import { Tool } from '@/types'
import { Modal, ModalBody, ModalFooter } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useRecentTags } from '@/hooks/use-recent-tags'
import { X } from 'lucide-react'
import { useToast } from '@/components/ui/toast'

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

function validateSchema(schemaStr: string, showToast: (message: string, type?: "error" | "success" | "info") => void): any {
  try {
    const schema = JSON.parse(schemaStr)
    
    if (!schema.type || schema.type !== 'function') {
      showToast('JSON Schema must have type: "function"', 'error')
      return;
    }
    
    if (!schema.function) {
      showToast('JSON Schema must have a "function" property', 'error')
      return;
    }
    
    if (!schema.function.name || !schema.function.description) {
      showToast('JSON Schema function must have name and description', 'error')
      return;
    }
    
    return schema
  } catch (error) {
    showToast(`Invalid JSON schema: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
    return;
  }
}

interface ToolFormModalProps {
  isOpen: boolean
  onClose: () => void
  mode: 'create' | 'edit'
  tool?: Tool
  onToolCreate?: (tool: Tool) => Promise<Tool> | Tool | void
  onToolUpdate?: (tool: Tool) => Promise<Tool> | Tool | void
  initialData?: {
    name?: string
    description?: string
    schema?: string
    tag?: string
  }
  onSuccess?: (tool: Tool) => void 
}

export function ToolFormModal({
  isOpen,
  onClose,
  mode,
  tool,
  onToolCreate,
  onToolUpdate,
  initialData,
  onSuccess
}: ToolFormModalProps) {
  const { recentTags, addRecentTag, removeRecentTag } = useRecentTags()
  const { showToast, ToastContainer } = useToast()
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    schema: '',
    tag: ''
  })

  const getDefaultSchema = () => JSON.stringify({
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
  }, null, 2)

  const resetForm = () => {
    if (mode === 'edit' && tool) {
      setFormData({
        name: tool.name,
        description: tool.description,
        schema: JSON.stringify(tool.schema, null, 2),
        tag: tool.tag || ''
      })
    } else {
      setFormData({
        name: initialData?.name || '',
        description: initialData?.description || '',
        schema: initialData?.schema || getDefaultSchema(),
        tag: initialData?.tag || ''
      })
    }
  }

  useEffect(() => {
    if (isOpen) {
      resetForm()
    }
  }, [isOpen, mode, tool, initialData])

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.description.trim()) {
      showToast('Name and description are required', 'error')
      return
    }

    const schema = validateSchema(formData.schema, showToast)
    if (!schema) return

    schema.function.name = formData.name

    try {
      let resultTool: Tool

      if (mode === 'create') {
        const newTool: Tool = {
          id: `tool_${Date.now()}`,
          name: formData.name,
          description: formData.description,
          schema,
          tag: formData.tag || undefined,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }

        if (onToolCreate) {
          const result = await onToolCreate(newTool)
          resultTool = result || newTool
        } else {
          resultTool = newTool
        }
      } else {
        if (!tool) return

        const updatedTool: Tool = {
          ...tool,
          name: formData.name,
          description: formData.description,
          schema,
          tag: formData.tag || undefined,
          updatedAt: Date.now()
        }

        if (onToolUpdate) {
          const result = await onToolUpdate(updatedTool)
          resultTool = result || updatedTool
        } else {
          resultTool = updatedTool
        }
      }

      if (formData.tag && formData.tag.trim()) {
        addRecentTag(formData.tag.trim())
      }

      if (onSuccess) {
        onSuccess(resultTool)
      }

      onClose()
      resetForm()
    } catch (error) {
      console.warn(`Failed to ${mode} tool:`, error)
      showToast(`Failed to ${mode} tool: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
    }
  }

  const handleClose = () => {
    onClose()
    resetForm()
  }

  const title = mode === 'create' ? 'Create New Tool' : 'Edit Tool'
  const submitText = mode === 'create' ? 'Create Tool' : 'Update Tool'

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={title}
      size="lg"
    >
      <ModalBody>
        <div className="space-y-4">
          <div>
            <Label htmlFor="tool-name">Name</Label>
            <Input
              id="tool-name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Tool name"
            />
          </div>

          <div>
            <Label htmlFor="tool-description">Description</Label>
            <Input
              id="tool-description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Brief description of the tool"
            />
          </div>

          <div>
            <Label htmlFor="tool-tag">Tag (Optional)</Label>
            <Input
              id="tool-tag"
              value={formData.tag}
              onChange={(e) => setFormData(prev => ({ ...prev, tag: e.target.value }))}
              placeholder="Enter tag name"
            />
            <RecentTagsPills
              recentTags={recentTags}
              onTagClick={(tag) => setFormData(prev => ({ ...prev, tag }))}
              onTagRemove={removeRecentTag}
            />
          </div>

          <div>
            <Label htmlFor="tool-schema">JSON Schema</Label>
            <Textarea
              id="tool-schema"
              value={formData.schema}
              onChange={(e) => setFormData(prev => ({ ...prev, schema: e.target.value }))}
              placeholder="Tool JSON schema"
              rows={12}
              className="font-mono text-sm"
            />
          </div>
        </div>
      </ModalBody>

      <ModalFooter>
        <Button variant="outline" onClick={handleClose}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!formData.name.trim() || !formData.description.trim()}
        >
          {submitText}
        </Button>
      </ModalFooter>

      <ToastContainer />
    </Modal>
  )
}

interface ToolCreateModalProps {
  isOpen: boolean
  onClose: () => void
  onToolCreate: (tool: Tool) => Promise<Tool> | Tool | void
  initialData?: {
    name?: string
    description?: string
    schema?: string
    tag?: string
  }
}

export function ToolCreateModal(props: ToolCreateModalProps) {
  return (
    <ToolFormModal
      {...props}
      mode="create"
    />
  )
}
