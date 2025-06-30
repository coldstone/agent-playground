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

export function ToolCreateModal({
  isOpen,
  onClose,
  onToolCreate,
  initialData
}: ToolCreateModalProps) {
  const { recentTags, addRecentTag, removeRecentTag } = useRecentTags()
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    schema: '',
    tag: ''
  })
  const [schemaError, setSchemaError] = useState('')

  const resetForm = () => {
    setFormData({
      name: initialData?.name || '',
      description: initialData?.description || '',
      schema: initialData?.schema || JSON.stringify({
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
      tag: initialData?.tag || ''
    })
    setSchemaError('')
  }

  useEffect(() => {
    if (isOpen) {
      resetForm()
    }
  }, [isOpen, initialData])

  const validateSchema = (schemaStr: string) => {
    try {
      const schema = JSON.parse(schemaStr)
      if (!schema.type || schema.type !== 'function') {
        setSchemaError('Schema must have type "function"')
        return null
      }
      if (!schema.function || !schema.function.name || !schema.function.description) {
        setSchemaError('Schema must have function.name and function.description')
        return null
      }
      setSchemaError('')
      return schema
    } catch (error) {
      setSchemaError('Invalid JSON format')
      return null
    }
  }

  const handleCreate = async () => {
    if (!formData.name.trim() || !formData.description.trim()) {
      setSchemaError('Name and description are required')
      return
    }

    const schema = validateSchema(formData.schema)
    if (!schema) return

    // Update schema function name to match tool name
    schema.function.name = formData.name

    const newTool: Tool = {
      id: `tool_${Date.now()}`,
      name: formData.name,
      description: formData.description,
      schema,
      tag: formData.tag || undefined,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    try {
      await onToolCreate(newTool)
      
      // 添加标签到最近使用列表
      if (formData.tag && formData.tag.trim()) {
        addRecentTag(formData.tag.trim())
      }

      onClose()
      resetForm()
    } catch (error) {
      console.error('Failed to create tool:', error)
    }
  }



  const handleClose = () => {
    onClose()
    resetForm()
  }

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title="Create New Tool"
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
              {schemaError && (
                <p className="text-sm text-red-600 mt-1">{schemaError}</p>
              )}
            </div>
          </div>
        </ModalBody>
        
        <ModalFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>

          <Button
            onClick={handleCreate}
            disabled={!formData.name.trim() || !formData.description.trim()}
          >
            Create Tool
          </Button>
        </ModalFooter>
      </Modal>
    </>
  )
}
