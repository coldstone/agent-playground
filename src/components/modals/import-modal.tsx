'use client'

import React, { useState, useEffect } from 'react'
import { Agent, Tool, Skill, SkillFileRecord } from '@/types'
import { X, Upload, Bot, Wrench, AlertTriangle, BookOpen } from 'lucide-react'
import { SerializedSkillFile, deserializeSkillFiles } from '@/lib/skills'
import { useToast } from '@/components/ui/toast'

interface ImportData {
  agents: Agent[]
  tools: Tool[]
  // Optional: exports written before skills existed simply have nothing to import
  skills?: Skill[]
  skillFiles?: SerializedSkillFile[]
}

interface ImportModalProps {
  isOpen: boolean
  onClose: () => void
  onImport: (agents: Agent[], tools: Tool[], skills: Skill[], skillFiles: SkillFileRecord[]) => void
  existingAgents: Agent[]
  existingTools: Tool[]
  existingSkills: Skill[]
}

// Helper function to merge headers, preserving existing values
const mergeHeaders = (existingHeaders: { key: string; value: string }[], importHeaders: { key: string; value: string }[]) => {
  const existingHeaderMap = new Map(existingHeaders.map(h => [h.key, h.value]))

  // Start with import headers structure
  const mergedHeaders = importHeaders.map(importHeader => ({
    key: importHeader.key,
    value: existingHeaderMap.get(importHeader.key) || importHeader.value // Use existing value if available
  }))

  return mergedHeaders
}

export function ImportModal({ isOpen, onClose, onImport, existingAgents, existingTools, existingSkills }: ImportModalProps) {
  const { showToast, ToastContainer } = useToast()
  const [importData, setImportData] = useState<ImportData | null>(null)
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set())
  const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set())
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set())

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setImportData(null)
      setSelectedAgents(new Set())
      setSelectedTools(new Set())
      setSelectedSkills(new Set())
    }
  }, [isOpen])

  // Auto-select all items when import data is loaded
  useEffect(() => {
    if (importData) {
      setSelectedAgents(new Set(importData.agents.map(a => a.id)))
      setSelectedTools(new Set(importData.tools.map(t => t.id)))
      setSelectedSkills(new Set((importData.skills || []).map(skill => skill.id)))
    }
  }, [importData])

  // Auto-select tools when agents are selected
  useEffect(() => {
    if (!importData) return
    
    const requiredTools = new Set<string>()
    selectedAgents.forEach(agentId => {
      const agent = importData.agents.find(a => a.id === agentId)
      if (agent) {
        agent.tools.forEach(toolId => requiredTools.add(toolId))
      }
    })
    
    setSelectedTools(prev => {
      const newSelected = new Set(prev)
      requiredTools.forEach(toolId => newSelected.add(toolId))
      return newSelected
    })
  }, [selectedAgents, importData])

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string
        const data = JSON.parse(content) as ImportData
        
        // Validate the data structure
        if (data && Array.isArray(data.agents) && Array.isArray(data.tools) && !data.skills) {
          data.skills = []
        }
        if (data && data.skills && !data.skillFiles) {
          data.skillFiles = []
        }
        if (!data.agents || !data.tools || !Array.isArray(data.agents) || !Array.isArray(data.tools)) {
          showToast('Invalid file format. Expected agents and tools arrays.', 'error')
          return
        }

        setImportData(data)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to parse file'
        showToast(errorMessage, 'error')
        setImportData(null)
      }
    }
    reader.readAsText(file)
  }

  const handleAgentToggle = (agentId: string) => {
    setSelectedAgents(prev => {
      const newSet = new Set(prev)
      if (newSet.has(agentId)) {
        newSet.delete(agentId)
      } else {
        newSet.add(agentId)
      }
      return newSet
    })
  }

  const handleToolToggle = (toolId: string) => {
    if (!importData) return
    
    // Check if this tool is required by any selected agent
    const isRequired = Array.from(selectedAgents).some(agentId => {
      const agent = importData.agents.find(a => a.id === agentId)
      return agent?.tools.includes(toolId)
    })

    if (isRequired) return // Don't allow deselecting required tools

    setSelectedTools(prev => {
      const newSet = new Set(prev)
      if (newSet.has(toolId)) {
        newSet.delete(toolId)
      } else {
        newSet.add(toolId)
      }
      return newSet
    })
  }

  const isToolRequired = (toolId: string) => {
    if (!importData) return false
    return Array.from(selectedAgents).some(agentId => {
      const agent = importData.agents.find(a => a.id === agentId)
      return agent?.tools.includes(toolId)
    })
  }

  const handleSkillToggle = (skillId: string) => {
    setSelectedSkills(prev => {
      const newSet = new Set(prev)
      if (newSet.has(skillId)) {
        newSet.delete(skillId)
      } else {
        newSet.add(skillId)
      }
      return newSet
    })
  }

  // Skills collide by name, not by id: importing "pdf-processing" replaces the installed one
  const isSkillConflict = (skill: Skill) => {
    return existingSkills.some(existing => existing.name === skill.name)
  }

  const isAgentConflict = (agentId: string) => {
    return existingAgents.some(a => a.id === agentId)
  }

  const isToolConflict = (toolId: string) => {
    return existingTools.some(t => t.id === toolId)
  }

  const handleImport = () => {
    if (!importData) return

    const agentsToImport = importData.agents.filter(agent => selectedAgents.has(agent.id))

    // Process tools to merge headers with existing values
    const toolsToImport = importData.tools
      .filter(tool => selectedTools.has(tool.id))
      .map(importTool => {
        const existingTool = existingTools.find(t => t.id === importTool.id)

        if (existingTool?.httpRequest?.headers && importTool.httpRequest?.headers) {
          return {
            ...importTool,
            httpRequest: {
              ...importTool.httpRequest,
              headers: mergeHeaders(existingTool.httpRequest.headers, importTool.httpRequest.headers)
            }
          }
        }

        return importTool
      })

    const skillsToImport = (importData.skills || []).filter(skill => selectedSkills.has(skill.id))
    const skillIds = skillsToImport.map(skill => skill.id)
    const skillFilesToImport = deserializeSkillFiles(
      (importData.skillFiles || []).filter(file => skillIds.indexOf(file.skillId) !== -1)
    )

    onImport(agentsToImport, toolsToImport, skillsToImport, skillFilesToImport)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-background border border-border rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Import Agents & Tools
          </h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {!importData ? (
            <div className="text-center py-8 text-muted-foreground">
              <Upload className="w-12 h-12 mx-auto mb-4 opacity-60" />
              <h3 className="text-lg font-medium mb-2">Select a file to import</h3>
              <p className="text-muted-foreground mb-4">Choose a JSON file containing agents and tools</p>
              <label className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer transition-colors">
                <Upload className="w-4 h-4" />
                Choose File
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Agents Section */}
              <div>
                <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
                  <Bot className="w-4 h-4" />
                  Agents ({importData.agents.length})
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {importData.agents.map(agent => {
                    const hasConflict = isAgentConflict(agent.id)
                    return (
                      <label key={agent.id} className="flex items-center gap-3 p-2 hover:bg-muted/60 rounded cursor-pointer border border-border bg-card">
                        <input
                          type="checkbox"
                          checked={selectedAgents.has(agent.id)}
                          onChange={() => handleAgentToggle(agent.id)}
                          className="apg-checkbox"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-foreground flex items-center gap-2">
                            {agent.name}
                            {hasConflict && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-50 dark:bg-orange-950/20 text-orange-700 dark:text-orange-400 text-xs rounded">
                                <AlertTriangle className="w-3 h-3" />
                                Will overwrite
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">{agent.description}</div>
                          {agent.tools.length > 0 && (
                            <div className="text-xs text-blue-600 mt-1">
                              Uses {agent.tools.length} tool{agent.tools.length !== 1 ? 's' : ''}
                            </div>
                          )}
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Tools Section */}
              <div>
                <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
                  <Wrench className="w-4 h-4" />
                  Tools ({importData.tools.length})
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {importData.tools.map(tool => {
                    const isRequired = isToolRequired(tool.id)
                    const hasConflict = isToolConflict(tool.id)
                    return (
                      <label key={tool.id} className={`flex items-center gap-3 p-2 hover:bg-muted/60 rounded border border-border bg-card ${isRequired ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                        <input
                          type="checkbox"
                          checked={selectedTools.has(tool.id)}
                          onChange={() => handleToolToggle(tool.id)}
                          disabled={isRequired}
                          className="apg-checkbox"
                        />
                        <div className="flex-1">
                          <div className="font-medium text-foreground flex items-center gap-2">
                            {tool.name}
                            {hasConflict && (
                              <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-50 dark:bg-orange-950/20 text-orange-700 dark:text-orange-400 text-xs rounded">
                                <AlertTriangle className="w-3 h-3" />
                                Will overwrite
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground">{tool.description}</div>
                          {isRequired && (
                            <div className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                              Required by selected agent(s)
                            </div>
                          )}
                        </div>
                      </label>
                    )
                  })}
                </div>
              </div>

              {/* Skills Section */}
              {importData.skills && importData.skills.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium mb-3 flex items-center gap-2">
                    <BookOpen className="w-4 h-4" />
                    Skills ({importData.skills.length})
                  </h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {importData.skills.map(skill => {
                      const hasConflict = isSkillConflict(skill)
                      const fileCount = (importData.skillFiles || []).filter(file => file.skillId === skill.id).length
                      return (
                        <label key={skill.id} className="flex items-center gap-3 p-2 hover:bg-muted/60 rounded cursor-pointer border border-border bg-card">
                          <input
                            type="checkbox"
                            checked={selectedSkills.has(skill.id)}
                            onChange={() => handleSkillToggle(skill.id)}
                            className="apg-checkbox"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-foreground flex items-center gap-2">
                              {skill.name}
                              {hasConflict && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-50 dark:bg-orange-950/20 text-orange-700 dark:text-orange-400 text-xs rounded">
                                  <AlertTriangle className="w-3 h-3" />
                                  Will replace
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground line-clamp-2">{skill.description}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {fileCount} file{fileCount !== 1 ? 's' : ''}
                            </div>
                          </div>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {importData && (
          <div className="flex items-center justify-between p-6 border-t border-border bg-muted">
            <div className="text-sm text-muted-foreground">
              Selected: {selectedAgents.size} agent{selectedAgents.size !== 1 ? 's' : ''}, {selectedTools.size} tool{selectedTools.size !== 1 ? 's' : ''}, {selectedSkills.size} skill{selectedSkills.size !== 1 ? 's' : ''}
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                disabled={selectedAgents.size === 0 && selectedTools.size === 0 && selectedSkills.size === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Import
              </button>
            </div>
          </div>
        )}
      </div>
      <ToastContainer />
    </div>
  )
}
