'use client'

import React, { useState } from 'react'
import { Tool, ToolSchema } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { generateId, formatTimestamp } from '@/lib/utils'
import { Plus, Wrench as ToolIcon, Edit2, Trash2, Check, X, Code } from 'lucide-react'

interface ToolEditorProps {
  tools: Tool[]
  onToolCreate: (tool: Omit<Tool, 'id' | 'createdAt' | 'updatedAt'>) => void
  onToolUpdate: (toolId: string, tool: Partial<Tool>) => void
  onToolDelete: (toolId: string) => void
}

const DEFAULT_TOOL_TEMPLATES = [
  {
    name: 'get_weather',
    description: 'Get current weather information for a location',
    schema: {
      type: 'function' as const,
      function: {
        name: 'get_weather',
        description: 'Get current weather information for a location',
        parameters: {
          type: 'object',
          properties: {
            location: {
              type: 'string',
              description: 'The city and state, e.g. San Francisco, CA'
            },
            unit: {
              type: 'string',
              enum: ['celsius', 'fahrenheit'],
              description: 'The temperature unit to use'
            }
          },
          required: ['location']
        }
      }
    }
  },
  {
    name: 'search_web',
    description: 'Search the web for information',
    schema: {
      type: 'function' as const,
      function: {
        name: 'search_web',
        description: 'Search the web for information',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The search query'
            },
            num_results: {
              type: 'number',
              description: 'Number of results to return',
              minimum: 1,
              maximum: 10
            }
          },
          required: ['query']
        }
      }
    }
  }
]

export function ToolEditor({ tools, onToolCreate, onToolUpdate, onToolDelete }: ToolEditorProps) {
  const [isCreating, setIsCreating] = useState(false)
  const [editingToolId, setEditingToolId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    schema: '' // JSON string
  })
  const [schemaError, setSchemaError] = useState('')

  const handleStartCreate = (template?: typeof DEFAULT_TOOL_TEMPLATES[0]) => {
    if (template) {
      setFormData({
        name: template.name,
        description: template.description,
        schema: JSON.stringify(template.schema, null, 2)
      })
    } else {
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
        }, null, 2)
      })
    }
    setSchemaError('')
    setIsCreating(true)
  }

  const handleStartEdit = (tool: Tool) => {
    setFormData({
      name: tool.name,
      description: tool.description,
      schema: JSON.stringify(tool.schema, null, 2)
    })
    setSchemaError('')
    setEditingToolId(tool.id)
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

  const handleSave = () => {
    if (!formData.name.trim() || !formData.description.trim()) {
      setSchemaError('Name and description are required')
      return
    }

    const schema = validateSchema(formData.schema)
    if (!schema) return

    // Update schema function name to match tool name
    schema.function.name = formData.name

    const toolData = {
      name: formData.name,
      description: formData.description,
      schema
    }

    if (isCreating) {
      onToolCreate(toolData)
      setIsCreating(false)
    } else if (editingToolId) {
      onToolUpdate(editingToolId, toolData)
      setEditingToolId(null)
    }

    setFormData({ name: '', description: '', schema: '' })
  }

  const handleCancel = () => {
    setIsCreating(false)
    setEditingToolId(null)
    setFormData({ name: '', description: '', schema: '' })
    setSchemaError('')
  }

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (field === 'schema') {
      setSchemaError('')
    }
  }

  const isEditing = isCreating || editingToolId !== null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <ToolIcon className="w-5 h-5" />
          Tools ({tools.length})
        </h3>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleStartCreate()}
            disabled={isEditing}
          >
            <Plus className="w-4 h-4 mr-2" />
            Custom
          </Button>
        </div>
      </div>

      {!isEditing && (
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Quick Templates</h4>
          <div className="flex gap-2 flex-wrap">
            {DEFAULT_TOOL_TEMPLATES.map((template) => (
              <Button
                key={template.name}
                variant="outline"
                size="sm"
                onClick={() => handleStartCreate(template)}
                className="text-xs"
              >
                {template.name}
              </Button>
            ))}
          </div>
        </div>
      )}

      {isEditing && (
        <div className="border border-border rounded-lg p-4 space-y-4 bg-card">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">
              {isCreating ? 'Create New Tool' : 'Edit Tool'}
            </h4>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={!formData.name.trim()}>
                <Check className="w-4 h-4" />
              </Button>
              <Button size="sm" variant="outline" onClick={handleCancel}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="tool-name">Name</Label>
              <Input
                id="tool-name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Tool function name (e.g., get_weather)"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tool-description">Description</Label>
              <Input
                id="tool-description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Brief description of what this tool does"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tool-schema" className="flex items-center gap-2">
                <Code className="w-4 h-4" />
                JSON Schema
              </Label>
              <Textarea
                id="tool-schema"
                value={formData.schema}
                onChange={(e) => handleInputChange('schema', e.target.value)}
                placeholder="Tool schema in OpenAI function format"
                rows={12}
                className="font-mono text-sm"
              />
              {schemaError && (
                <div className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-200">
                  {schemaError}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tools.length > 0 && !isEditing && (
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Created Tools</h4>
          <div className="space-y-2">
            {tools.map((tool) => (
              <div
                key={tool.id}
                className="p-3 rounded-lg border border-border hover:bg-muted transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h5 className="font-medium text-sm truncate">{tool.name}</h5>
                    <p className="text-xs text-muted-foreground mt-1">
                      {tool.description}
                    </p>
                    <div className="text-xs text-muted-foreground mt-2">
                      {formatTimestamp(tool.updatedAt)}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleStartEdit(tool)}
                      className="h-6 w-6 p-0"
                    >
                      <Edit2 className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onToolDelete(tool.id)}
                      className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tools.length === 0 && !isEditing && (
        <div className="text-center py-8 text-muted-foreground">
          <ToolIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No tools created yet</p>
          <p className="text-xs">Create tools to enable agent functionality</p>
        </div>
      )}
    </div>
  )
}
