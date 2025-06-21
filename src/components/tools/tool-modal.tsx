'use client'

import React, { useState, useEffect } from 'react'
import { Tool, ToolSchema, APIConfig, HTTPRequestConfig } from '@/types'
import { Modal, ModalBody, ModalFooter } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ToolGeneratorModal } from './tool-generator-modal'
import { HttpRequestModal as HTTPRequestModal } from '@/components/modals'
import { ToolGenerator } from '@/lib/generators'
import { generateId, formatTimestamp } from '@/lib/utils'
import { Plus, Wrench as ToolIcon, Edit2, Trash2, Code, Sparkles, Globe } from 'lucide-react'

interface ToolModalProps {
  isOpen: boolean
  onClose: () => void
  tools: Tool[]
  config: APIConfig
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
  },
  {
    name: 'calculate',
    description: 'Perform mathematical calculations',
    schema: {
      type: 'function' as const,
      function: {
        name: 'calculate',
        description: 'Perform mathematical calculations',
        parameters: {
          type: 'object',
          properties: {
            expression: {
              type: 'string',
              description: 'Mathematical expression to evaluate (e.g., "2 + 3 * 4")'
            }
          },
          required: ['expression']
        }
      }
    }
  }
]

export function ToolModal({
  isOpen,
  onClose,
  tools,
  config,
  onToolCreate,
  onToolUpdate,
  onToolDelete
}: ToolModalProps) {
  const [view, setView] = useState<'list' | 'create' | 'edit'>('list')
  const [editingTool, setEditingTool] = useState<Tool | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    schema: ''
  })
  const [schemaError, setSchemaError] = useState('')
  const [showGeneratorModal, setShowGeneratorModal] = useState(false)
  const [showHttpRequestModal, setShowHttpRequestModal] = useState(false)
  const [httpRequestTool, setHttpRequestTool] = useState<Tool | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  useEffect(() => {
    if (!isOpen) {
      setView('list')
      setEditingTool(null)
      resetForm()
    }
  }, [isOpen])

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
      }, null, 2)
    })
    setSchemaError('')
  }

  const handleCreate = (template?: typeof DEFAULT_TOOL_TEMPLATES[0]) => {
    if (template) {
      setFormData({
        name: template.name,
        description: template.description,
        schema: JSON.stringify(template.schema, null, 2)
      })
    } else {
      resetForm()
    }
    setView('create')
  }

  const handleEdit = (tool: Tool) => {
    setEditingTool(tool)
    setFormData({
      name: tool.name,
      description: tool.description,
      schema: JSON.stringify(tool.schema, null, 2)
    })
    setView('edit')
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

    if (view === 'create') {
      onToolCreate(toolData)
    } else if (view === 'edit' && editingTool) {
      onToolUpdate(editingTool.id, toolData)
    }

    setView('list')
    resetForm()
  }

  const handleCancel = () => {
    setView('list')
    resetForm()
  }

  const handleDelete = (toolId: string) => {
    if (confirm('Are you sure you want to delete this tool?')) {
      onToolDelete(toolId)
    }
  }

  const handleGenerateTool = async (prompt: string) => {
    if (!config?.apiKey || !config?.endpoint) {
      alert('Please configure your API settings first')
      return
    }

    setIsGenerating(true)
    try {
      const generator = new ToolGenerator(config)
      const generatedTool = await generator.generateTool(prompt)

      // Fill the form with generated data
      setFormData({
        name: generatedTool.name,
        description: generatedTool.description,
        schema: JSON.stringify(generatedTool.schema, null, 2)
      })
      setSchemaError('')

      // Switch to create view if not already there
      if (view !== 'create') {
        setView('create')
      }
    } catch (error) {
      console.error('Tool generation failed:', error)
      alert(`Failed to generate tool: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsGenerating(false)
    }
  }

  const handleConfigureHttpRequest = (tool: Tool) => {
    setHttpRequestTool(tool)
    setShowHttpRequestModal(true)
  }

  const handleSaveHttpRequest = (config: HTTPRequestConfig) => {
    if (httpRequestTool) {
      onToolUpdate(httpRequestTool.id, { httpRequest: config })
    }
    setShowHttpRequestModal(false)
    setHttpRequestTool(null)
  }

  const renderListView = () => (
    <ModalBody>
      <div className="flex flex-col h-[calc(80vh-8rem)] min-h-[500px]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium">Manage Tools</h3>
          <div className="flex gap-2">
            <Button
              onClick={() => setShowGeneratorModal(true)}
              size="sm"
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
              disabled={!config?.apiKey || !config?.endpoint}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              AI Generate
            </Button>
            <Button onClick={() => handleCreate()} size="sm" variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Custom
            </Button>
          </div>
        </div>

        <div className="space-y-2 mb-4">
          <h4 className="font-medium text-sm">Quick Templates</h4>
          <div className="flex gap-2 flex-wrap">
            {DEFAULT_TOOL_TEMPLATES.map((template) => (
              <Button
                key={template.name}
                variant="outline"
                size="sm"
                onClick={() => handleCreate(template)}
                className="text-xs"
              >
                {template.name}
              </Button>
            ))}
          </div>
        </div>

        {tools.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-center text-muted-foreground">
            <div>
              <ToolIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No tools created yet</p>
              <p className="text-xs">Create tools to enable agent functionality</p>
            </div>
          </div>
        ) : (
          <>
            <h4 className="font-medium text-sm mb-3">Created Tools ({tools.length})</h4>
            <div className="flex-1 overflow-y-auto space-y-3 pr-2">
              {tools.sort((a, b) => a.name.localeCompare(b.name)).map((tool) => (
                <div
                  key={tool.id}
                  className="p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h5 className="font-medium text-sm truncate">{tool.name}</h5>
                      <p className="text-xs text-muted-foreground mt-1">
                        {tool.description}
                      </p>
                      {tool.httpRequest && (
                        <div className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                          <Globe className="w-3 h-3" />
                          <span className="font-mono">{tool.httpRequest.method}</span>
                          <span className="truncate">{tool.httpRequest.url}</span>
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground mt-2">
                        {formatTimestamp(tool.updatedAt)}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleConfigureHttpRequest(tool)}
                        className="h-8 w-8 p-0"
                        title="Configure HTTP Request"
                      >
                        <Globe className="w-3 h-3 flex-shrink-0" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(tool)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit2 className="w-3 h-3 flex-shrink-0" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(tool.id)}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-3 h-3 flex-shrink-0" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </ModalBody>
  )

  const renderFormView = () => (
    <>
      <ModalBody>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tool-name">Name</Label>
            <Input
              id="tool-name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Tool function name (e.g., get_weather)"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tool-description">Description</Label>
            <Input
              id="tool-description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
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
              onChange={(e) => setFormData(prev => ({ ...prev, schema: e.target.value }))}
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
      </ModalBody>
      
      <ModalFooter>
        <Button variant="outline" onClick={handleCancel}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={!formData.name.trim()}>
          {view === 'create' ? 'Create Tool' : 'Update Tool'}
        </Button>
      </ModalFooter>
    </>
  )

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={view === 'list' ? 'Tool Management' : (view === 'create' ? 'Create Tool' : 'Edit Tool')}
        size="lg"
      >
        {view === 'list' ? renderListView() : renderFormView()}
      </Modal>

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
    </>
  )
}
