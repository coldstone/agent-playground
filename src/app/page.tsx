'use client'

import React, { useState, useEffect, useRef } from 'react'
import { APIConfig, Message, ChatSession, Agent, Tool, AgentMessage, ToolCall } from '@/types'
import { DEFAULT_CONFIG, MODEL_PROVIDERS, generateId } from '@/lib'
import { OpenAIClient } from '@/lib/clients'
import { TitleGenerator } from '@/lib/generators'
import { IndexedDBManager } from '@/lib/storage'
import { AccordionPanel } from '@/components/config'
import { ChatMessages, ChatInput, ChatInputRef, ChatControls, SessionManager, NewChatOverlay } from '@/components/chat'
import { AgentFormModal } from '@/components/agents'
import { useSystemModel } from '@/hooks/use-system-model'


import { ExportModal, ImportModal, SystemPromptModal } from '@/components/modals'

export default function HomePage() {
  // Create initial config with empty provider to avoid triggering saves
  const initialConfig: APIConfig = {
    provider: '',
    endpoint: '',
    apiKey: '',
    model: '',
    ...DEFAULT_CONFIG
  }

  const [config, setConfig] = useState<APIConfig>(initialConfig)
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [streamingContent, setStreamingContent] = useState('')
  const [streamingReasoningContent, setStreamingReasoningContent] = useState('')
  const [streamingToolCalls, setStreamingToolCalls] = useState<ToolCall[]>([])

  const [agents, setAgents] = useState<Agent[]>([])
  const [currentAgentId, setCurrentAgentId] = useState<string | null>(null)
  const [tools, setTools] = useState<Tool[]>([])
  const [dbManager] = useState(() => IndexedDBManager.getInstance())

  const [isMounted, setIsMounted] = useState(false)
  const [showAgentModal, setShowAgentModal] = useState(false)

  const [showExportModal, setShowExportModal] = useState(false)
  const [showImportModal, setShowImportModal] = useState(false)
  const [showNewChatOverlay, setShowNewChatOverlay] = useState(true) // Start with overlay visible

  // System Model hook for AI generation
  const { getSystemModelConfig } = useSystemModel()
  const [expandedReasoningMessages, setExpandedReasoningMessages] = useState<Set<string>>(new Set())
  const [isStreamingReasoningExpanded, setIsStreamingReasoningExpanded] = useState(false)
  const [isInActiveConversation, setIsInActiveConversation] = useState(false)

  const [reasoningDuration, setReasoningDuration] = useState<number | null>(null)
  const [scrollToBottomTrigger, setScrollToBottomTrigger] = useState(0)
  const abortControllerRef = useRef<AbortController | null>(null)
  const chatInputRef = useRef<ChatInputRef>(null)

  // Tool selection for no-agent mode
  const [selectedToolIds, setSelectedToolIds] = useState<string[]>([])

  // System prompt modal
  const [showSystemPromptModal, setShowSystemPromptModal] = useState(false)

  // 格式化思考时长
  const formatReasoningDuration = (durationMs: number) => {
    const seconds = durationMs / 1000
    if (seconds < 60) {
      return `${seconds.toFixed(1)}s`
    } else {
      const minutes = Math.floor(seconds / 60)
      const remainingSeconds = Math.floor(seconds % 60)
      return `${minutes}m ${remainingSeconds}s`
    }
  }

  // 处理推理框展开/收起
  const toggleReasoningExpansion = (messageId: string) => {
    setExpandedReasoningMessages(prev => {
      const newSet = new Set(prev)
      if (newSet.has(messageId)) {
        newSet.delete(messageId)
      } else {
        newSet.add(messageId)
      }
      return newSet
    })
  }

  // Set mounted state to avoid hydration issues
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Validate and cleanup models in IndexedDB against current providers
  const validateAndCleanupModels = async () => {
    try {
      // Get all valid models from current providers
      const validModelIds = new Set<string>()
      MODEL_PROVIDERS.forEach(provider => {
        if (provider.models) {
          provider.models.forEach(model => {
            validModelIds.add(`${provider.name}-${model}`)
          })
        }
      })

      // Get all available models from IndexedDB
      const availableModels = await dbManager.getAllAvailableModels()

      // Find models that are no longer valid
      const modelsToRemove: string[] = []
      availableModels.forEach(availableModel => {
        if (!validModelIds.has(availableModel.id)) {
          modelsToRemove.push(availableModel.id)
        }
      })

      // Remove invalid models from IndexedDB
      if (modelsToRemove.length > 0) {
        console.log('Removing invalid models from IndexedDB:', modelsToRemove)
        for (const modelId of modelsToRemove) {
          await dbManager.deleteAvailableModel(modelId)
        }
      }

      // Check if current model is still valid
      const currentModelStr = localStorage.getItem('agent-playground-current-model')
      if (currentModelStr) {
        try {
          const currentModel = JSON.parse(currentModelStr)
          const currentModelKey = `${currentModel.provider}-${currentModel.model}`
          if (!validModelIds.has(currentModelKey)) {
            console.log('Current model is no longer valid, clearing:', currentModel)
            localStorage.removeItem('agent-playground-current-model')
          }
        } catch (error) {
          console.error('Failed to parse current model, clearing:', error)
          localStorage.removeItem('agent-playground-current-model')
        }
      }

      // Check if system model is still valid
      const systemModelStr = localStorage.getItem('agent-playground-system-model')
      if (systemModelStr) {
        try {
          const systemModel = JSON.parse(systemModelStr)
          const systemModelKey = `${systemModel.provider}-${systemModel.model}`
          if (!validModelIds.has(systemModelKey)) {
            console.log('System model is no longer valid, clearing:', systemModel)
            localStorage.removeItem('agent-playground-system-model')
          }
        } catch (error) {
          console.error('Failed to parse system model, clearing:', error)
          localStorage.removeItem('agent-playground-system-model')
        }
      }
    } catch (error) {
      console.error('Failed to validate and cleanup models:', error)
    }
  }

  // Load data from IndexedDB and localStorage on mount
  useEffect(() => {
    if (!isMounted) return

    const loadData = async () => {
      try {
        // Initialize IndexedDB first
        await dbManager.init()

        // Validate and clean up available models
        await validateAndCleanupModels()

        // Load current provider from localStorage
        const savedProviderName = localStorage.getItem('agent-playground-current-provider')
        const provider = savedProviderName
          ? MODEL_PROVIDERS.find(p => p.name === savedProviderName) || MODEL_PROVIDERS[0]
          : MODEL_PROVIDERS[0]

        // Load provider-specific configuration from IndexedDB
        const providerConfig = await dbManager.getProviderConfig(provider.name)

        // Load common settings from localStorage
        const llmConfigStr = localStorage.getItem('agent-playground-llm-config')
        const llmConfig = llmConfigStr ? JSON.parse(llmConfigStr) : {}

        const systemPrompt = llmConfig.systemPrompt || DEFAULT_CONFIG.systemPrompt
        const temperature = llmConfig.temperature || DEFAULT_CONFIG.temperature
        const maxTokens = llmConfig.maxTokens || DEFAULT_CONFIG.maxTokens
        const topP = llmConfig.topP || DEFAULT_CONFIG.topP
        const frequencyPenalty = llmConfig.frequencyPenalty || DEFAULT_CONFIG.frequencyPenalty
        const presencePenalty = llmConfig.presencePenalty || DEFAULT_CONFIG.presencePenalty

        // Load API keys from localStorage
        const apiKeysStr = localStorage.getItem('agent-playground-api-keys')
        const apiKeys = apiKeysStr ? JSON.parse(apiKeysStr) : {}
        const apiKey = apiKeys[provider.name] || ''

        // Build final configuration
        let finalConfig: APIConfig

        if (provider.name === 'Custom') {
          // For Custom provider, all configuration comes from IndexedDB
          finalConfig = {
            provider: provider.name,
            endpoint: providerConfig?.endpoint || '',
            apiKey,
            model: providerConfig?.currentModel || 'custom-model',
            systemPrompt,
            temperature,
            maxTokens,
            topP,
            frequencyPenalty,
            presencePenalty
          }
        } else {
          finalConfig = {
            provider: provider.name,
            endpoint: providerConfig?.endpoint || provider.endpoint,
            apiKey,
            model: providerConfig?.currentModel || provider.defaultModel,
            systemPrompt,
            temperature,
            maxTokens,
            topP,
            frequencyPenalty,
            presencePenalty
          }
        }

        setConfig(finalConfig)

        // Only save provider to localStorage if it wasn't already saved
        if (!savedProviderName) {
          localStorage.setItem('agent-playground-current-provider', provider.name)
        }

        // Load all data in parallel
        const [loadedSessions, loadedAgents, loadedTools] = await Promise.all([
          dbManager.getAllSessions(),
          dbManager.getAllAgents(),
          dbManager.getAllTools()
        ])

        setSessions(loadedSessions)
        setAgents(loadedAgents)
        setTools(loadedTools)

        // Don't auto-load previous session - always start with new chat overlay
        // Clear any saved session state
        localStorage.removeItem('agent-playground-current-session')
        localStorage.removeItem('agent-playground-current-agent')



      } catch (error) {
        console.error('Failed to load data from IndexedDB:', error)
      }
    }

    loadData()
  }, [isMounted])

  // Save provider selection when it changes (but not during initial load)
  useEffect(() => {
    if (config.provider && config.provider !== '') {
      localStorage.setItem('agent-playground-current-provider', config.provider)
    }
  }, [config.provider])

  useEffect(() => {
    if (currentSessionId) {
      localStorage.setItem('agent-playground-current-session', currentSessionId)
    }
  }, [currentSessionId])

  useEffect(() => {
    if (currentAgentId) {
      localStorage.setItem('agent-playground-current-agent', currentAgentId)
    }
  }, [currentAgentId])

  // Reset active conversation state when session changes
  useEffect(() => {
    setIsInActiveConversation(false)
  }, [currentSessionId])

  const currentSession = sessions.find(s => s.id === currentSessionId)
  const currentAgent = currentAgentId ? agents.find(a => a.id === currentAgentId) : null

  // Get current agent with latest tool information
  const currentAgentWithTools = currentAgent ? {
    ...currentAgent,
    tools: currentAgent.tools
      .map(toolId => tools.find(t => t.id === toolId))
      .filter((tool): tool is Tool => tool !== undefined)
  } : null

  const createNewSession = async () => {
    // Clear current session and show the new chat overlay
    setCurrentSessionId(null)
    setCurrentAgentId(null)
    setShowNewChatOverlay(true)
  }

  const handleOverlaySendMessage = async (content: string, agentId: string | null, toolIds?: string[]) => {
    // Set the current agent (but don't create session yet)
    setCurrentAgentId(agentId)

    // Set selected tools for no-agent mode
    if (!agentId && toolIds) {
      setSelectedToolIds(toolIds)
    }

    // Clear current session so handleSendMessage will create a new one
    setCurrentSessionId(null)

    // Close the overlay immediately to show the chat interface
    setShowNewChatOverlay(false)

    // Send the message - this will create the session with the first message
    await handleSendMessage(content, toolIds)
  }

  const deleteSession = async (sessionId: string) => {
    try {
      await dbManager.deleteSession(sessionId)
      setSessions(prev => prev.filter(s => s.id !== sessionId))

      if (currentSessionId === sessionId) {
        const remainingSessions = sessions.filter(s => s.id !== sessionId)
        setCurrentSessionId(remainingSessions.length > 0 ? remainingSessions[0].id : null)
      }
    } catch (error) {
      console.error('Failed to delete session:', error)
    }
  }

  const renameSession = async (sessionId: string, newName: string) => {
    const session = sessions.find(s => s.id === sessionId)
    if (!session) return

    const updatedSession = { ...session, name: newName, updatedAt: Date.now() }

    try {
      await dbManager.saveSession(updatedSession)
      setSessions(prev => prev.map(s =>
        s.id === sessionId ? updatedSession : s
      ))
    } catch (error) {
      console.error('Failed to rename session:', error)
    }
  }





  // Agent management functions
  const createAgent = async (agentData: Omit<Agent, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newAgent: Agent = {
      ...agentData,
      id: generateId(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    try {
      await dbManager.saveAgent(newAgent)
      setAgents(prev => [...prev, newAgent])

      // Auto-select the newly created agent if we're in new chat overlay
      if (showNewChatOverlay) {
        setCurrentAgentId(newAgent.id)
      }

      return newAgent.id
    } catch (error) {
      console.error('Failed to create agent:', error)
      throw error
    }
  }

  const updateAgent = async (agentId: string, updates: Partial<Agent>) => {
    const updatedAgent = agents.find(a => a.id === agentId)
    if (!updatedAgent) return

    const newAgent = { ...updatedAgent, ...updates, updatedAt: Date.now() }

    try {
      await dbManager.saveAgent(newAgent)
      setAgents(prev => prev.map(agent =>
        agent.id === agentId ? newAgent : agent
      ))
    } catch (error) {
      console.error('Failed to update agent:', error)
      throw error
    }
  }

  const handleAgentInstructionUpdate = async (agentId: string, instruction: string) => {
    try {
      await updateAgent(agentId, { systemPrompt: instruction })
    } catch (error) {
      console.error('Failed to update agent instruction:', error)
      throw error
    }
  }

  const handleAgentToolsUpdate = async (agentId: string, toolIds: string[]) => {
    try {
      await updateAgent(agentId, { tools: toolIds })
    } catch (error) {
      console.error('Failed to update agent tools:', error)
      throw error
    }
  }

  const deleteAgent = async (agentId: string) => {
    try {
      await dbManager.deleteAgent(agentId)
      setAgents(prev => prev.filter(agent => agent.id !== agentId))
      if (currentAgentId === agentId) {
        setCurrentAgentId(null)
      }
    } catch (error) {
      console.error('Failed to delete agent:', error)
      throw error
    }
  }

  const reorderAgents = async (reorderedAgents: Agent[]) => {
    try {
      // Update the order in state immediately for UI responsiveness
      setAgents(reorderedAgents)

      // Save the new order to IndexedDB
      for (let i = 0; i < reorderedAgents.length; i++) {
        const agent = reorderedAgents[i]
        const updatedAgent = { ...agent, order: i, updatedAt: Date.now() }
        await dbManager.saveAgent(updatedAgent)
      }
    } catch (error) {
      console.error('Failed to reorder agents:', error)
      // Reload agents from DB on error
      try {
        const loadedAgents = await dbManager.getAllAgents()
        setAgents(loadedAgents)
      } catch (reloadError) {
        console.error('Failed to reload agents:', reloadError)
      }
    }
  }

  // Tool management functions
  const createTool = async (toolData: Omit<Tool, 'id' | 'createdAt' | 'updatedAt'> | Tool) => {
    // If toolData already has an id, we need to replace it with a new one
    const newTool: Tool = {
      ...toolData,
      id: generateId(),
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    try {
      await dbManager.saveTool(newTool)
      setTools(prev => [...prev, newTool])
      return newTool
    } catch (error) {
      console.error('Failed to create tool:', error)
      throw error
    }
  }

  const updateTool = async (toolId: string, updates: Partial<Tool>) => {
    const updatedTool = tools.find(t => t.id === toolId)
    if (!updatedTool) return

    const newTool = { ...updatedTool, ...updates, updatedAt: Date.now() }

    try {
      await dbManager.saveTool(newTool)
      setTools(prev => prev.map(tool =>
        tool.id === toolId ? newTool : tool
      ))
    } catch (error) {
      console.error('Failed to update tool:', error)
      throw error
    }
  }

  const deleteTool = async (toolId: string) => {
    try {
      await dbManager.deleteTool(toolId)
      setTools(prev => prev.filter(tool => tool.id !== toolId))

      // Also remove from agents and save them
      const updatedAgents = agents.map(agent => ({
        ...agent,
        tools: agent.tools.filter(toolIdInAgent => toolIdInAgent !== toolId),
        updatedAt: Date.now()
      })).filter(agent => agent.tools.length !== agents.find(a => a.id === agent.id)?.tools.length)

      // Save updated agents to IndexedDB
      for (const agent of updatedAgents) {
        await dbManager.saveAgent(agent)
      }

      setAgents(prev => prev.map(agent => ({
        ...agent,
        tools: agent.tools.filter(toolIdInAgent => toolIdInAgent !== toolId),
        updatedAt: Date.now()
      })))
    } catch (error) {
      console.error('Failed to delete tool:', error)
      throw error
    }
  }

  // Import/Export functions
  const handleImport = async (importAgents: Agent[], importTools: Tool[]) => {
    try {
      // Import tools first (agents may reference them)
      for (const tool of importTools) {
        await dbManager.saveTool(tool)
      }

      // Import agents
      for (const agent of importAgents) {
        await dbManager.saveAgent(agent)
      }

      // Reload data from database
      const [loadedAgents, loadedTools] = await Promise.all([
        dbManager.getAllAgents(),
        dbManager.getAllTools()
      ])

      setAgents(loadedAgents)
      setTools(loadedTools)

      console.log(`Imported ${importAgents.length} agents and ${importTools.length} tools`)
    } catch (error) {
      console.error('Failed to import data:', error)
      throw error
    }
  }

  // Continue conversation after tool execution
  const continueConversationAfterTool = async (sessionData: ChatSession) => {
    setIsLoading(true)
    setStreamingContent('')
    setStreamingToolCalls([])

    // Create new AbortController for this request
    abortControllerRef.current = new AbortController()

    try {
      // Get tools for agent mode
      const agentTools = currentAgentWithTools ? currentAgentWithTools.tools : []

      // Get complete config for current model (includes correct endpoint and API key)
      const currentConfig = getCurrentModelConfig()

      const client = new OpenAIClient(currentConfig, agentTools, currentConfig.provider)

      // Filter out any existing system messages from history to avoid conflicts
      const messagesWithoutSystem = sessionData.messages.filter(m => m.role !== 'system')

      // Use agent system prompt if in agent mode, otherwise use config system prompt
      // When agent is selected, ONLY use agent's system prompt, ignore config system prompt
      const systemPrompt = currentAgent ? currentAgent.systemPrompt : config.systemPrompt
      const allMessages = systemPrompt.trim()
        ? [{ id: generateId(), role: 'system' as const, content: systemPrompt, timestamp: Date.now() }, ...messagesWithoutSystem]
        : messagesWithoutSystem

      let assistantContent = ''
      let reasoningContent = ''
      let toolCalls: ToolCall[] = []
      let usage: any = null
      let localReasoningStartTime: number | null = null
      let localReasoningDuration: number | null = null

      // Stream the response
      for await (const chunk of client.streamChatCompletion(allMessages, abortControllerRef.current.signal)) {
        if (chunk.reasoningContent) {
          // 记录推理开始时间
          if (!localReasoningStartTime) {
            localReasoningStartTime = Date.now()
          }
          reasoningContent += chunk.reasoningContent
          setStreamingReasoningContent(reasoningContent)
          // 自动展开流式推理框并设置为活跃对话状态
          setIsStreamingReasoningExpanded(true)
          setIsInActiveConversation(true)
        }
        if (chunk.content) {
          // 如果有推理内容且这是第一次接收到 content，计算思考时长
          if (reasoningContent && localReasoningStartTime && !localReasoningDuration) {
            localReasoningDuration = Date.now() - localReasoningStartTime
            setReasoningDuration(localReasoningDuration)
          }
          assistantContent += chunk.content
          setStreamingContent(assistantContent)
        }
        if (chunk.usage) {
          usage = chunk.usage
        }
        if (chunk.toolCalls) {
          // Handle tool calls streaming according to OpenAI API format
          const updatedToolCalls = [...toolCalls]

          for (const rawToolCall of chunk.toolCalls) {
            // Cast to handle OpenAI streaming format which includes index
            const streamingToolCall = rawToolCall as any

            // Use index to find existing tool call (OpenAI streaming uses index)
            const targetIndex = streamingToolCall.index !== undefined ? streamingToolCall.index :
                               updatedToolCalls.findIndex(tc => tc.id === streamingToolCall.id)

            if (targetIndex >= 0 && updatedToolCalls[targetIndex]) {
              // Update existing tool call - append arguments
              const existing = updatedToolCalls[targetIndex]
              updatedToolCalls[targetIndex] = {
                ...existing,
                function: {
                  ...existing.function,
                  arguments: (existing.function?.arguments || '') + (streamingToolCall.function?.arguments || '')
                }
              }
            } else {
              // First chunk with complete structure - create new tool call
              const completeToolCall: ToolCall = {
                id: streamingToolCall.id || `call_${Date.now()}`,
                type: 'function',
                function: {
                  name: streamingToolCall.function?.name || 'unknown',
                  arguments: streamingToolCall.function?.arguments || ''
                }
              }

              // Insert at correct index or append
              if (streamingToolCall.index !== undefined) {
                updatedToolCalls[streamingToolCall.index] = completeToolCall
              } else {
                updatedToolCalls.push(completeToolCall)
              }
            }
          }

          toolCalls = updatedToolCalls
          // Show streaming tool calls immediately (with typing effect for arguments)
          setStreamingToolCalls([...updatedToolCalls])
        }
      }

      // Filter out incomplete tool calls (those without arguments)
      const completeToolCalls = toolCalls.filter(tc =>
        tc.function?.arguments && tc.function.arguments.trim() !== ''
      )

      // Debug logging
      console.log('All tool calls:', toolCalls)
      console.log('Complete tool calls:', completeToolCalls)

      // 流结束后，如果有推理内容，设置为非活跃状态以显示收起/展开按钮
      if (reasoningContent) {
        setIsInActiveConversation(false)
      }

      // Save the assistant message with tool calls only after streaming is complete
      if (assistantContent || completeToolCalls.length > 0) {
        const agentMessage: AgentMessage = {
          id: generateId(),
          role: 'assistant',
          content: assistantContent,
          timestamp: Date.now(),
          toolCalls: completeToolCalls.length > 0 ? completeToolCalls : undefined,
          toolCallExecutions: completeToolCalls.length > 0 ? completeToolCalls.map(tc => ({
            id: generateId(),
            toolCall: tc,
            status: 'pending' as const,
            timestamp: Date.now()
          })) : undefined,
          usage: usage || undefined,
          reasoningContent: reasoningContent || undefined,
          reasoningDuration: localReasoningDuration || undefined,
          provider: config.provider,
          model: config.model
        }

        // Clear streaming states after creating the message
        setStreamingContent('')
        setStreamingReasoningContent('')
        setStreamingToolCalls([])
        setIsStreamingReasoningExpanded(false)
        setReasoningDuration(null)

        // Save the assistant message to the session
        const finalUpdatedSession = {
          ...sessionData,
          messages: [...sessionData.messages, agentMessage],
          updatedAt: Date.now()
        }

        try {
          await dbManager.saveSession(finalUpdatedSession)
          setSessions(prev => prev.map(s =>
            s.id === sessionData.id ? finalUpdatedSession : s
          ))
        } catch (error) {
          console.error('Failed to save assistant message:', error)
        }
      } else {
        // Clear streaming states even if no message to save
        setStreamingContent('')
        setStreamingToolCalls([])
      }

    } catch (error) {
      console.error('Chat error:', error)

      // Don't show error message if request was aborted (user clicked stop)
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Request was aborted by user')
      } else {
        // Create error message with retry capability
        const errorMessage: Message = {
          id: generateId(),
          role: 'assistant',
          content: `Request failed: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
          timestamp: Date.now(),
          error: error instanceof Error ? error.message : 'Unknown error occurred',
          canRetry: true
        }

        // Save error message to session
        const sessionWithError = {
          ...sessionData,
          messages: [...sessionData.messages, errorMessage],
          updatedAt: Date.now()
        }

        try {
          await dbManager.saveSession(sessionWithError)
          setSessions(prev => prev.map(s =>
            s.id === sessionData.id ? sessionWithError : s
          ))
        } catch (saveError) {
          console.error('Failed to save error message:', saveError)
        }
      }
    } finally {
      setIsLoading(false)
      setStreamingContent('')
      setStreamingToolCalls([])

      // Focus input after tool conversation response is complete
      setTimeout(() => {
        chatInputRef.current?.focus()
      }, 100)
    }
  }

  const handleSendMessage = async (content: string, toolIds?: string[]) => {
    // Get complete config for current model to check if it's properly configured
    const currentConfig = getCurrentModelConfig()
    if (!currentConfig.apiKey.trim() || !currentConfig.endpoint.trim()) {
      return
    }

    // Create a new session if none exists or if current session is not in sessions list (temporary session)
    let sessionId = currentSessionId
    let currentSessionData = currentSessionId ? sessions.find(s => s.id === currentSessionId) : null

    if (!sessionId || !currentSessionData) {
      const newSession: ChatSession = {
        id: sessionId || generateId(), // Use existing sessionId if available (from New Chat button)
        name: 'New Conversation',
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        agentId: currentAgentId || undefined, // Include the current agent ID
        toolIds: !currentAgentId && toolIds ? toolIds : undefined, // Include tools for no-agent mode
        systemPrompt: !currentAgentId ? config.systemPrompt : undefined // Use LLM config system prompt for no-agent mode
      }

      // Now save to IndexedDB and add to sessions list when user sends first message
      try {
        await dbManager.saveSession(newSession)
        setSessions(prev => [newSession, ...prev])
        setCurrentSessionId(newSession.id)
        sessionId = newSession.id
        currentSessionData = newSession
      } catch (error) {
        console.error('Failed to create session:', error)
        return
      }
    }

    if (!currentSessionData) {
      console.error('No session data available')
      return
    }

    // Create user message
    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content,
      timestamp: Date.now()
    }

    // Update the session data with the new user message
    let updatedSessionData = {
      ...currentSessionData,
      messages: [...currentSessionData.messages, userMessage],
      updatedAt: Date.now()
    }

    // Save the updated session with user message
    try {
      await dbManager.saveSession(updatedSessionData)
      setSessions(prev => prev.map(s =>
        s.id === sessionId ? updatedSessionData : s
      ))

      // Generate title from user's first message if session name is still "New Conversation"
      if (updatedSessionData.name === 'New Conversation' && content.trim()) {
        try {
          const systemModelConfig = getSystemModelConfig()
          if (systemModelConfig) {
            const titleGenerator = new TitleGenerator(systemModelConfig)
            const newTitle = await titleGenerator.generateTitle(content)

            if (newTitle && newTitle !== 'New Conversation') {
              const sessionWithTitle = {
                ...updatedSessionData,
                name: newTitle,
                updatedAt: Date.now()
              }

              await dbManager.saveSession(sessionWithTitle)
              setSessions(prev => prev.map(s =>
                s.id === sessionId ? sessionWithTitle : s
              ))

              // Update the current session data reference for the rest of the function
              updatedSessionData = sessionWithTitle
            }
          }
        } catch (titleError) {
          console.error('Failed to generate title from user message:', titleError)
          // Don't fail the whole operation if title generation fails
        }
      }
    } catch (error) {
      console.error('Failed to save user message:', error)
      return
    }

    setIsLoading(true)
    setStreamingContent('')
    setStreamingToolCalls([])

    // Create new AbortController for this request
    abortControllerRef.current = new AbortController()

    try {
      // Get tools for agent mode or no-agent mode
      let availableTools: Tool[] = []
      if (currentAgentWithTools) {
        // Agent mode: use agent's tools
        availableTools = currentAgentWithTools.tools
      } else {
        // No-agent mode: use selected tools from session or current selection
        const sessionToolIds = updatedSessionData.toolIds || toolIds || []
        availableTools = tools.filter(tool => sessionToolIds.includes(tool.id))
      }

      // Get complete config for current model (includes correct endpoint and API key)
      const currentConfig = getCurrentModelConfig()

      const client = new OpenAIClient(currentConfig, availableTools, currentConfig.provider)

      // Filter out any existing system messages from history to avoid conflicts
      const messagesWithoutSystem = updatedSessionData.messages.filter(m => m.role !== 'system')

      // Use session system prompt, agent system prompt, or config system prompt
      const systemPrompt = updatedSessionData.systemPrompt ||
                          (currentAgent ? currentAgent.systemPrompt : config.systemPrompt)

      // Debug logging
      console.log('=== System Prompt Debug ===')
      console.log('currentAgentId:', currentAgentId)
      console.log('currentAgent:', currentAgent)
      console.log('currentAgent.systemPrompt:', currentAgent?.systemPrompt)
      console.log('config.systemPrompt:', config.systemPrompt)
      console.log('Final systemPrompt:', systemPrompt)
      console.log('========================')

      const allMessages = systemPrompt.trim()
        ? [{ id: generateId(), role: 'system' as const, content: systemPrompt, timestamp: Date.now() }, ...messagesWithoutSystem]
        : messagesWithoutSystem

      let assistantContent = ''
      let reasoningContent = ''
      let toolCalls: ToolCall[] = []
      let usage: any = null
      let localReasoningStartTime: number | null = null
      let localReasoningDuration: number | null = null

      // Stream the response - use the messages from the session including the new user message
      for await (const chunk of client.streamChatCompletion(allMessages, abortControllerRef.current.signal)) {
        if (chunk.reasoningContent) {
          // 记录推理开始时间
          if (!localReasoningStartTime) {
            localReasoningStartTime = Date.now()
          }
          reasoningContent += chunk.reasoningContent
          setStreamingReasoningContent(reasoningContent)
          // 自动展开流式推理框并设置为活跃对话状态
          setIsStreamingReasoningExpanded(true)
          setIsInActiveConversation(true)
        }
        if (chunk.content) {
          // 如果有推理内容且这是第一次接收到 content，计算思考时长
          if (reasoningContent && localReasoningStartTime && !localReasoningDuration) {
            localReasoningDuration = Date.now() - localReasoningStartTime
            setReasoningDuration(localReasoningDuration)
          }
          assistantContent += chunk.content
          setStreamingContent(assistantContent)
        }
        if (chunk.usage) {
          usage = chunk.usage
        }
        if (chunk.toolCalls) {
          // Handle tool calls streaming according to OpenAI API format
          const updatedToolCalls = [...toolCalls]

          for (const rawToolCall of chunk.toolCalls) {
            // Cast to handle OpenAI streaming format which includes index
            const streamingToolCall = rawToolCall as any

            // Use index to find existing tool call (OpenAI streaming uses index)
            const targetIndex = streamingToolCall.index !== undefined ? streamingToolCall.index :
                               updatedToolCalls.findIndex(tc => tc.id === streamingToolCall.id)

            if (targetIndex >= 0 && updatedToolCalls[targetIndex]) {
              // Update existing tool call - append arguments
              const existing = updatedToolCalls[targetIndex]
              updatedToolCalls[targetIndex] = {
                ...existing,
                function: {
                  ...existing.function,
                  arguments: (existing.function?.arguments || '') + (streamingToolCall.function?.arguments || '')
                }
              }
            } else {
              // First chunk with complete structure - create new tool call
              const completeToolCall: ToolCall = {
                id: streamingToolCall.id || `call_${Date.now()}`,
                type: 'function',
                function: {
                  name: streamingToolCall.function?.name || 'unknown',
                  arguments: streamingToolCall.function?.arguments || ''
                }
              }

              // Insert at correct index or append
              if (streamingToolCall.index !== undefined) {
                updatedToolCalls[streamingToolCall.index] = completeToolCall
              } else {
                updatedToolCalls.push(completeToolCall)
              }
            }
          }

          toolCalls = updatedToolCalls
          // Show streaming tool calls immediately (with typing effect for arguments)
          setStreamingToolCalls([...updatedToolCalls])
        }
      }

      // Filter out incomplete tool calls (those without arguments)
      const completeToolCalls = toolCalls.filter(tc =>
        tc.function?.arguments && tc.function.arguments.trim() !== ''
      )

      // Debug logging
      console.log('All tool calls:', toolCalls)
      console.log('Complete tool calls:', completeToolCalls)

      // 流结束后，如果有推理内容，设置为非活跃状态以显示收起/展开按钮
      if (reasoningContent) {
        setIsInActiveConversation(false)
      }

      // Save the assistant message with tool calls only after streaming is complete
      if (assistantContent || completeToolCalls.length > 0) {
        const agentMessage: AgentMessage = {
          id: generateId(),
          role: 'assistant',
          content: assistantContent,
          timestamp: Date.now(),
          toolCalls: completeToolCalls.length > 0 ? completeToolCalls : undefined,
          toolCallExecutions: completeToolCalls.length > 0 ? completeToolCalls.map(tc => ({
            id: generateId(),
            toolCall: tc,
            status: 'pending' as const,
            timestamp: Date.now()
          })) : undefined,
          usage: usage || undefined,
          reasoningContent: reasoningContent || undefined,
          reasoningDuration: localReasoningDuration || undefined,
          provider: config.provider,
          model: config.model
        }

        // Clear streaming states after creating the message
        setStreamingContent('')
        setStreamingReasoningContent('')
        setStreamingToolCalls([])
        setIsStreamingReasoningExpanded(false)

        setReasoningDuration(null)

        // Save the assistant message to the session
        const finalUpdatedSession = {
          ...updatedSessionData,
          messages: [...updatedSessionData.messages, agentMessage],
          updatedAt: Date.now()
        }

        try {
          await dbManager.saveSession(finalUpdatedSession)
          setSessions(prev => prev.map(s =>
            s.id === sessionId ? finalUpdatedSession : s
          ))

          // Title generation is now handled when user sends first message
        } catch (error) {
          console.error('Failed to save assistant message:', error)
        }
      } else {
        // Clear streaming states even if no message to save
        setStreamingContent('')
        setStreamingReasoningContent('')
        setStreamingToolCalls([])
        setIsStreamingReasoningExpanded(false)

        setReasoningDuration(null)
      }

    } catch (error) {
      console.error('Chat error:', error)

      // Don't show error message if request was aborted (user clicked stop)
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Request was aborted by user')
      } else {
        // Create error message with retry capability
        const errorMessage: Message = {
          id: generateId(),
          role: 'assistant',
          content: `Request failed: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
          timestamp: Date.now(),
          error: error instanceof Error ? error.message : 'Unknown error occurred',
          canRetry: true
        }

        // Save error message to session
        if (sessionId && updatedSessionData) {
          const sessionWithError = {
            ...updatedSessionData,
            messages: [...updatedSessionData.messages, errorMessage],
            updatedAt: Date.now()
          }

          try {
            await dbManager.saveSession(sessionWithError)
            setSessions(prev => prev.map(s =>
              s.id === sessionId ? sessionWithError : s
            ))
          } catch (saveError) {
            console.error('Failed to save error message:', saveError)
          }
        }
      }
    } finally {
      setIsLoading(false)
      setStreamingContent('')
      setStreamingReasoningContent('')
      setStreamingToolCalls([])
      setIsStreamingReasoningExpanded(false)

      setReasoningDuration(null)

      // Focus input after AI response is complete and tokens are displayed
      setTimeout(() => {
        chatInputRef.current?.focus()
      }, 100)
    }
  }

  const handleStop = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Save the partial assistant message if there's any content (reasoning or regular content)
    if ((streamingContent.trim() || streamingReasoningContent.trim()) && currentSessionId) {
      const session = sessions.find(s => s.id === currentSessionId)
      if (session) {
        const partialMessage: AgentMessage = {
          id: generateId(),
          role: 'assistant',
          content: streamingContent,
          reasoningContent: streamingReasoningContent || undefined,
          reasoningDuration: reasoningDuration || undefined,
          timestamp: Date.now(),
          // Mark as incomplete/stopped
          incomplete: true,
          provider: config.provider,
          model: config.model
        }

        const updatedSession = {
          ...session,
          messages: [...session.messages, partialMessage],
          updatedAt: Date.now()
        }

        try {
          await dbManager.saveSession(updatedSession)
          setSessions(prev => prev.map(s =>
            s.id === currentSessionId ? updatedSession : s
          ))
        } catch (error) {
          console.error('Failed to save partial message:', error)
        }
      }
    }

    setIsLoading(false)
    setStreamingContent('')
    setStreamingReasoningContent('')
    setStreamingToolCalls([])
    setIsStreamingReasoningExpanded(false)

    setReasoningDuration(null)
  }

  // System prompt handlers
  const handleSystemPromptSave = async (prompt: string) => {
    if (!currentSessionId) return

    const session = sessions.find(s => s.id === currentSessionId)
    if (!session) return

    const updatedSession = {
      ...session,
      systemPrompt: prompt.trim() || undefined,
      updatedAt: Date.now()
    }

    try {
      await dbManager.saveSession(updatedSession)
      setSessions(prev => prev.map(s =>
        s.id === currentSessionId ? updatedSession : s
      ))
    } catch (error) {
      console.error('Failed to save system prompt:', error)
    }
  }

  // Tool execution handlers
  const handleProvideToolResult = async (toolCallId: string, result: string) => {
    if (!currentSessionId) return

    const session = sessions.find(s => s.id === currentSessionId)
    if (!session) return

    const updatedSession = {
      ...session,
      messages: session.messages.map(msg => {
        const agentMsg = msg as AgentMessage
        if (agentMsg.toolCallExecutions) {
          return {
            ...agentMsg,
            toolCallExecutions: agentMsg.toolCallExecutions.map(exec =>
              exec.toolCall.id === toolCallId
                ? { ...exec, status: 'completed' as const, result, timestamp: Date.now() }
                : exec
            )
          }
        }
        return msg
      }),
      updatedAt: Date.now()
    }

    try {
      await dbManager.saveSession(updatedSession)
      setSessions(prev => prev.map(s =>
        s.id === currentSessionId ? updatedSession : s
      ))
    } catch (error) {
      console.error('Failed to save tool result:', error)
    }

    // Find the actual function name from the tool call
    let functionName = 'tool_result'
    const lastMessage = session.messages[session.messages.length - 1] as AgentMessage
    if (lastMessage?.toolCalls) {
      const toolCall = lastMessage.toolCalls.find(tc => tc.id === toolCallId)
      if (toolCall?.function?.name) {
        functionName = toolCall.function.name
      }
    }

    // Add tool result message according to OpenAI API format
    const toolMessage: Message = {
      id: generateId(),
      role: 'tool',
      content: result,
      timestamp: Date.now(),
      tool_call_id: toolCallId,
      name: functionName
    }

    // Update session with tool result message
    const sessionWithToolResult = {
      ...updatedSession,
      messages: [...updatedSession.messages, toolMessage],
      updatedAt: Date.now()
    }

    try {
      await dbManager.saveSession(sessionWithToolResult)
      setSessions(prev => prev.map(s =>
        s.id === currentSessionId ? sessionWithToolResult : s
      ))

      // Continue conversation with AI after tool result
      await continueConversationAfterTool(sessionWithToolResult)
    } catch (error) {
      console.error('Failed to save tool result and continue conversation:', error)
    }
  }

  // Retry message functionality
  const handleRetryMessage = async (messageId: string) => {
    if (!currentSessionId) return

    const session = sessions.find(s => s.id === currentSessionId)
    if (!session) return

    // Find the message to retry
    const messageIndex = session.messages.findIndex(m => m.id === messageId)
    if (messageIndex === -1) return

    const messageToRetry = session.messages[messageIndex]

    // For assistant messages (both error and success), regenerate response
    if (messageToRetry.role === 'assistant') {
      // Find the last user message before this assistant message
      const userMessages = session.messages.slice(0, messageIndex).filter(m => m.role === 'user')
      if (userMessages.length > 0) {
        // Remove the assistant message and all subsequent messages
        const updatedSession = {
          ...session,
          messages: session.messages.slice(0, messageIndex),
          updatedAt: Date.now()
        }

        try {
          await dbManager.saveSession(updatedSession)
          setSessions(prev => prev.map(s =>
            s.id === currentSessionId ? updatedSession : s
          ))

          // Directly regenerate response without using handleSendMessage
          setIsLoading(true)
          setStreamingContent('')
          setStreamingToolCalls([])

          // Create new AbortController for this request
          abortControllerRef.current = new AbortController()

          // Get tools for agent mode
          const agentTools = currentAgentWithTools ? currentAgentWithTools.tools : []

          // Get complete config for current model (includes correct endpoint and API key)
          const currentConfig = getCurrentModelConfig()

          const client = new OpenAIClient(currentConfig, agentTools, currentConfig.provider)

          // Filter out any existing system messages from history to avoid conflicts
          const messagesWithoutSystem = updatedSession.messages.filter(m => m.role !== 'system')

          // Use agent system prompt if in agent mode, otherwise use config system prompt
          const systemPrompt = currentAgent ? currentAgent.systemPrompt : config.systemPrompt
          const allMessages = systemPrompt.trim()
            ? [{ id: generateId(), role: 'system' as const, content: systemPrompt, timestamp: Date.now() }, ...messagesWithoutSystem]
            : messagesWithoutSystem

          let assistantContent = ''
          let reasoningContent = ''
          let toolCalls: ToolCall[] = []
          let usage: any = null
          let localReasoningStartTime: number | null = null
          let localReasoningDuration: number | null = null

          // Stream the response
          for await (const chunk of client.streamChatCompletion(allMessages, abortControllerRef.current.signal)) {
            if (chunk.reasoningContent) {
              // 记录推理开始时间
              if (!localReasoningStartTime) {
                localReasoningStartTime = Date.now()
              }
              reasoningContent += chunk.reasoningContent
              setStreamingReasoningContent(reasoningContent)
              // 自动展开流式推理框并设置为活跃对话状态
              setIsStreamingReasoningExpanded(true)
              setIsInActiveConversation(true)
            }
            if (chunk.content) {
              // 如果有推理内容且这是第一次接收到 content，计算思考时长
              if (reasoningContent && localReasoningStartTime && !localReasoningDuration) {
                localReasoningDuration = Date.now() - localReasoningStartTime
                setReasoningDuration(localReasoningDuration)
              }
              assistantContent += chunk.content
              setStreamingContent(assistantContent)
            }
            if (chunk.usage) {
              usage = chunk.usage
            }
            if (chunk.toolCalls) {
              // Handle tool calls streaming
              const updatedToolCalls = [...toolCalls]

              for (const rawToolCall of chunk.toolCalls) {
                const streamingToolCall = rawToolCall as any
                const targetIndex = streamingToolCall.index !== undefined ? streamingToolCall.index :
                                   updatedToolCalls.findIndex(tc => tc.id === streamingToolCall.id)

                if (targetIndex >= 0 && updatedToolCalls[targetIndex]) {
                  const existing = updatedToolCalls[targetIndex]
                  updatedToolCalls[targetIndex] = {
                    ...existing,
                    function: {
                      ...existing.function,
                      arguments: (existing.function?.arguments || '') + (streamingToolCall.function?.arguments || '')
                    }
                  }
                } else {
                  const completeToolCall: ToolCall = {
                    id: streamingToolCall.id || `call_${Date.now()}`,
                    type: 'function',
                    function: {
                      name: streamingToolCall.function?.name || 'unknown',
                      arguments: streamingToolCall.function?.arguments || ''
                    }
                  }

                  if (streamingToolCall.index !== undefined) {
                    updatedToolCalls[streamingToolCall.index] = completeToolCall
                  } else {
                    updatedToolCalls.push(completeToolCall)
                  }
                }
              }

              toolCalls = updatedToolCalls
              setStreamingToolCalls([...updatedToolCalls])
            }
          }

          // Filter out incomplete tool calls
          const completeToolCalls = toolCalls.filter(tc =>
            tc.function?.arguments && tc.function.arguments.trim() !== ''
          )

          // 流结束后，如果有推理内容，设置为非活跃状态以显示收起/展开按钮
          if (reasoningContent) {
            setIsInActiveConversation(false)
          }

          // Save the assistant message
          if (assistantContent || completeToolCalls.length > 0) {
            const agentMessage: AgentMessage = {
              id: generateId(),
              role: 'assistant',
              content: assistantContent,
              timestamp: Date.now(),
              toolCalls: completeToolCalls.length > 0 ? completeToolCalls : undefined,
              toolCallExecutions: completeToolCalls.length > 0 ? completeToolCalls.map(tc => ({
                id: generateId(),
                toolCall: tc,
                status: 'pending' as const,
                timestamp: Date.now()
              })) : undefined,
              usage: usage || undefined,
              reasoningContent: reasoningContent || undefined,
              reasoningDuration: localReasoningDuration || undefined,
              provider: config.provider,
              model: config.model
            }

            // Clear streaming states after creating the message
            setStreamingContent('')
            setStreamingReasoningContent('')
            setStreamingToolCalls([])
            setIsStreamingReasoningExpanded(false)

            setReasoningDuration(null)

            const finalSession = {
              ...updatedSession,
              messages: [...updatedSession.messages, agentMessage],
              updatedAt: Date.now()
            }

            await dbManager.saveSession(finalSession)
            setSessions(prev => prev.map(s =>
              s.id === currentSessionId ? finalSession : s
            ))
          }

          setIsLoading(false)
          setStreamingContent('')
          setStreamingReasoningContent('')
          setStreamingToolCalls([])
          setIsStreamingReasoningExpanded(false)

          // Focus input after retry response is complete
          setTimeout(() => {
            chatInputRef.current?.focus()
          }, 100)

        } catch (error) {
          console.error('Failed to retry message:', error)

          // Don't show error message if request was aborted (user clicked stop)
          if (error instanceof Error && error.name === 'AbortError') {
            console.log('Request was aborted by user')
          } else {
            // Create error message with retry capability
            const errorMessage: Message = {
              id: generateId(),
              role: 'assistant',
              content: `Retry failed: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
              timestamp: Date.now(),
              error: error instanceof Error ? error.message : 'Unknown error occurred',
              canRetry: true
            }

            // Save error message to session
            const sessionWithError = {
              ...updatedSession,
              messages: [...updatedSession.messages, errorMessage],
              updatedAt: Date.now()
            }

            try {
              await dbManager.saveSession(sessionWithError)
              setSessions(prev => prev.map(s =>
                s.id === currentSessionId ? sessionWithError : s
              ))
            } catch (saveError) {
              console.error('Failed to save error message:', saveError)
            }
          }

          setIsLoading(false)
          setStreamingContent('')
          setStreamingReasoningContent('')
          setStreamingToolCalls([])
          setIsStreamingReasoningExpanded(false)
        }
      }
    }
    // For tool messages, retry tool execution
    else if (messageToRetry.role === 'tool') {
      // Find the assistant message with tool calls before this tool message
      const assistantMessages = session.messages.slice(0, messageIndex).filter(m => m.role === 'assistant')
      const lastAssistantMessage = assistantMessages[assistantMessages.length - 1] as AgentMessage

      if (lastAssistantMessage && lastAssistantMessage.toolCalls) {
        // Find the tool call that corresponds to this tool result
        const toolCall = lastAssistantMessage.toolCalls.find(tc => tc.id === messageToRetry.tool_call_id)
        if (toolCall) {
          // Remove the tool result message and retry
          const updatedSession = {
            ...session,
            messages: session.messages.slice(0, messageIndex),
            updatedAt: Date.now()
          }

          try {
            await dbManager.saveSession(updatedSession)
            setSessions(prev => prev.map(s =>
              s.id === currentSessionId ? updatedSession : s
            ))

            // Re-execute the tool call
            // This would trigger the tool execution again
            // For now, we'll just remove the failed result and let user provide new result
          } catch (error) {
            console.error('Failed to retry tool message:', error)
          }
        }
      }
    }
    // For system messages, remove and regenerate conversation
    else if (messageToRetry.role === 'system') {
      // Remove the system message and all subsequent messages
      const updatedSession = {
        ...session,
        messages: session.messages.slice(0, messageIndex),
        updatedAt: Date.now()
      }

      try {
        await dbManager.saveSession(updatedSession)
        setSessions(prev => prev.map(s =>
          s.id === currentSessionId ? updatedSession : s
        ))
      } catch (error) {
        console.error('Failed to retry system message:', error)
      }
    }
  }

  // Delete message functionality
  const handleDeleteMessage = async (messageId: string) => {
    if (!currentSessionId) return

    const session = sessions.find(s => s.id === currentSessionId)
    if (!session) return

    const updatedSession = {
      ...session,
      messages: session.messages.filter(m => m.id !== messageId),
      updatedAt: Date.now()
    }

    try {
      await dbManager.saveSession(updatedSession)
      setSessions(prev => prev.map(s =>
        s.id === currentSessionId ? updatedSession : s
      ))
    } catch (error) {
      console.error('Failed to delete message:', error)
    }
  }

  // Session selection with agent switching
  const handleSessionSelect = (sessionId: string) => {
    setCurrentSessionId(sessionId)

    // Hide the new chat overlay when selecting a session
    setShowNewChatOverlay(false)

    // Auto-switch to the agent used in this session
    const session = sessions.find(s => s.id === sessionId)
    if (session) {
      // If session has an agentId, switch to that agent
      // If session has no agentId (undefined), clear agent selection
      setCurrentAgentId(session.agentId || null)
    }

    // Trigger scroll to bottom after session switch
    setTimeout(() => {
      setScrollToBottomTrigger(prev => prev + 1)
    }, 100)
  }

  // Agent selection with session update
  const handleAgentSelect = async (agentId: string | null) => {
    setCurrentAgentId(agentId)

    // Update current session's agentId
    if (currentSessionId) {
      const session = sessions.find(s => s.id === currentSessionId)
      if (session) {
        const updatedSession = {
          ...session,
          agentId: agentId || undefined,
          updatedAt: Date.now()
        }

        try {
          await dbManager.saveSession(updatedSession)
          setSessions(prev => prev.map(s =>
            s.id === currentSessionId ? updatedSession : s
          ))
        } catch (error) {
          console.error('Failed to update session agent:', error)
        }
      }
    }
  }

  // Get current model from localStorage
  const getCurrentModel = () => {
    // Check if we're in browser environment
    if (typeof window === 'undefined') {
      return null
    }

    try {
      const saved = localStorage.getItem('agent-playground-current-model')
      if (saved) {
        return JSON.parse(saved)
      }
    } catch (error) {
      console.error('Failed to parse current model:', error)
    }
    return null
  }

  // Get complete config for current model
  const getCurrentModelConfig = (): APIConfig => {
    // Check if we're in browser environment
    if (typeof window === 'undefined') {
      // Server-side rendering, return default config
      return config
    }

    const currentModel = getCurrentModel()

    if (!currentModel) {
      // No model selected, use default config
      return config
    }

    // Find the provider for the selected model
    const provider = MODEL_PROVIDERS.find(p => p.name === currentModel.provider)
    if (!provider) {
      console.warn(`Provider ${currentModel.provider} not found, using default config`)
      return config
    }

    try {
      // Get API keys from localStorage
      const apiKeysStr = localStorage.getItem('agent-playground-api-keys')
      const apiKeys = apiKeysStr ? JSON.parse(apiKeysStr) : {}
      const apiKey = apiKeys[provider.name] || ''

      // Get endpoints from localStorage (for custom endpoints)
      const endpointsStr = localStorage.getItem('agent-playground-api-endpoints')
      const endpoints = endpointsStr ? JSON.parse(endpointsStr) : {}
      const endpoint = endpoints[provider.name] || provider.endpoint

      // Create config with selected model's provider settings
      return {
        ...config,
        provider: provider.name,
        endpoint,
        apiKey,
        model: currentModel.model
      }
    } catch (error) {
      console.error('Failed to get current model config:', error)
      return config
    }
  }



  // Edit message functionality
  const handleEditMessage = async (messageId: string, newContent: string) => {
    if (!currentSessionId) return

    const session = sessions.find(s => s.id === currentSessionId)
    if (!session) return

    // Find the message index
    const messageIndex = session.messages.findIndex(m => m.id === messageId)
    if (messageIndex === -1) return

    // Remove the old user message and all messages after it (clear conversation history from this point)
    const messagesBeforeEdit = session.messages.slice(0, messageIndex)

    const updatedSession = {
      ...session,
      messages: messagesBeforeEdit,
      updatedAt: Date.now()
    }

    try {
      // Save the updated session (without the old message) and update state immediately
      await dbManager.saveSession(updatedSession)
      setSessions(prev => prev.map(s =>
        s.id === currentSessionId ? updatedSession : s
      ))

      // Create user message
      const userMessage: Message = {
        id: generateId(),
        role: 'user',
        content: newContent,
        timestamp: Date.now()
      }

      // Update the session data with the new user message
      const sessionWithNewMessage = {
        ...updatedSession,
        messages: [...updatedSession.messages, userMessage],
        updatedAt: Date.now()
      }

      // Save the updated session with user message
      await dbManager.saveSession(sessionWithNewMessage)
      setSessions(prev => prev.map(s =>
        s.id === currentSessionId ? sessionWithNewMessage : s
      ))

      // Generate title from user's message if session name is still "New Conversation"
      let finalSessionData = sessionWithNewMessage
      if (sessionWithNewMessage.name === 'New Conversation' && newContent.trim()) {
        try {
          const systemModelConfig = getSystemModelConfig()
          if (systemModelConfig) {
            const titleGenerator = new TitleGenerator(systemModelConfig)
            const newTitle = await titleGenerator.generateTitle(newContent)

            if (newTitle && newTitle !== 'New Conversation') {
              const sessionWithTitle = {
                ...sessionWithNewMessage,
                name: newTitle,
                updatedAt: Date.now()
              }

              await dbManager.saveSession(sessionWithTitle)
              setSessions(prev => prev.map(s =>
                s.id === currentSessionId ? sessionWithTitle : s
              ))

              finalSessionData = sessionWithTitle
            }
          }
        } catch (titleError) {
          console.error('Failed to generate title from edited message:', titleError)
          // Don't fail the whole operation if title generation fails
        }
      }

      setIsLoading(true)
      setStreamingContent('')
      setStreamingToolCalls([])

      // Create new AbortController for this request
      abortControllerRef.current = new AbortController()

      // Get tools for agent mode
      const agentTools = currentAgentWithTools ? currentAgentWithTools.tools : []

      // Get complete config for current model (includes correct endpoint and API key)
      const currentConfig = getCurrentModelConfig()

      const client = new OpenAIClient(currentConfig, agentTools, currentConfig.provider)

      // For API call, use the messages before edit plus the new user message
      // Filter out any existing system messages from history to avoid conflicts
      const messagesWithoutSystem = [...messagesBeforeEdit, userMessage].filter(m => m.role !== 'system')

      // Use agent system prompt if in agent mode, otherwise use config system prompt
      const systemPrompt = currentAgent ? currentAgent.systemPrompt : config.systemPrompt
      const allMessages = systemPrompt.trim()
        ? [{ id: generateId(), role: 'system' as const, content: systemPrompt, timestamp: Date.now() }, ...messagesWithoutSystem]
        : messagesWithoutSystem

      let assistantContent = ''
      let reasoningContent = ''
      let toolCalls: ToolCall[] = []
      let usage: any = null
      let localReasoningStartTime: number | null = null
      let localReasoningDuration: number | null = null

      // Stream the response
      for await (const chunk of client.streamChatCompletion(allMessages, abortControllerRef.current.signal)) {
        if (chunk.reasoningContent) {
          // 记录推理开始时间
          if (!localReasoningStartTime) {
            localReasoningStartTime = Date.now()
          }
          reasoningContent += chunk.reasoningContent
          setStreamingReasoningContent(reasoningContent)
          // 自动展开流式推理框并设置为活跃对话状态
          setIsStreamingReasoningExpanded(true)
          setIsInActiveConversation(true)
        }
        if (chunk.content) {
          // 如果有推理内容且这是第一次接收到 content，计算思考时长
          if (reasoningContent && localReasoningStartTime && !localReasoningDuration) {
            localReasoningDuration = Date.now() - localReasoningStartTime
            setReasoningDuration(localReasoningDuration)
          }
          assistantContent += chunk.content
          setStreamingContent(assistantContent)
        }
        if (chunk.usage) {
          usage = chunk.usage
        }
        if (chunk.toolCalls) {
          // Handle tool calls streaming
          const updatedToolCalls = [...toolCalls]

          for (const rawToolCall of chunk.toolCalls) {
            const streamingToolCall = rawToolCall as any
            const targetIndex = streamingToolCall.index !== undefined ? streamingToolCall.index :
                               updatedToolCalls.findIndex(tc => tc.id === streamingToolCall.id)

            if (targetIndex >= 0 && updatedToolCalls[targetIndex]) {
              const existing = updatedToolCalls[targetIndex]
              updatedToolCalls[targetIndex] = {
                ...existing,
                function: {
                  ...existing.function,
                  arguments: (existing.function?.arguments || '') + (streamingToolCall.function?.arguments || '')
                }
              }
            } else {
              const completeToolCall: ToolCall = {
                id: streamingToolCall.id || `call_${Date.now()}`,
                type: 'function',
                function: {
                  name: streamingToolCall.function?.name || 'unknown',
                  arguments: streamingToolCall.function?.arguments || ''
                }
              }

              if (streamingToolCall.index !== undefined) {
                updatedToolCalls[streamingToolCall.index] = completeToolCall
              } else {
                updatedToolCalls.push(completeToolCall)
              }
            }
          }

          toolCalls = updatedToolCalls
          setStreamingToolCalls([...updatedToolCalls])
        }
      }

      // Filter out incomplete tool calls
      const completeToolCalls = toolCalls.filter(tc =>
        tc.function?.arguments && tc.function.arguments.trim() !== ''
      )

      // 流结束后，如果有推理内容，设置为非活跃状态以显示收起/展开按钮
      if (reasoningContent) {
        setIsInActiveConversation(false)
      }

      // Save the assistant message
      if (assistantContent || completeToolCalls.length > 0) {
        const agentMessage: AgentMessage = {
          id: generateId(),
          role: 'assistant',
          content: assistantContent,
          timestamp: Date.now(),
          toolCalls: completeToolCalls.length > 0 ? completeToolCalls : undefined,
          toolCallExecutions: completeToolCalls.length > 0 ? completeToolCalls.map(tc => ({
            id: generateId(),
            toolCall: tc,
            status: 'pending' as const,
            timestamp: Date.now()
          })) : undefined,
          usage: usage || undefined,
          reasoningContent: reasoningContent || undefined,
          reasoningDuration: localReasoningDuration || undefined,
          provider: config.provider,
          model: config.model
        }

        // Clear streaming states after creating the message
        setStreamingContent('')
        setStreamingReasoningContent('')
        setStreamingToolCalls([])
        setIsStreamingReasoningExpanded(false)

        setReasoningDuration(null)

        const finalSession = {
          ...finalSessionData,
          messages: [...finalSessionData.messages, agentMessage],
          updatedAt: Date.now()
        }

        await dbManager.saveSession(finalSession)
        setSessions(prev => prev.map(s =>
          s.id === currentSessionId ? finalSession : s
        ))
      }

      setIsLoading(false)
      setStreamingContent('')
      setStreamingReasoningContent('')
      setStreamingToolCalls([])
      setIsStreamingReasoningExpanded(false)

    } catch (error) {
      console.error('Failed to edit message:', error)

      // Don't show error message if request was aborted (user clicked stop)
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Request was aborted by user')
      } else {
        // Create error message with retry capability
        const errorMessage: Message = {
          id: generateId(),
          role: 'assistant',
          content: `Edit failed: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
          timestamp: Date.now(),
          error: error instanceof Error ? error.message : 'Unknown error occurred',
          canRetry: true
        }

        // Save error message to session
        if (currentSessionId) {
          const session = sessions.find(s => s.id === currentSessionId)
          if (session) {
            const sessionWithError = {
              ...session,
              messages: [...session.messages, errorMessage],
              updatedAt: Date.now()
            }

            try {
              await dbManager.saveSession(sessionWithError)
              setSessions(prev => prev.map(s =>
                s.id === currentSessionId ? sessionWithError : s
              ))
            } catch (saveError) {
              console.error('Failed to save error message:', saveError)
            }
          }
        }
      }

      setIsLoading(false)
      setStreamingContent('')
      setStreamingReasoningContent('')
      setStreamingToolCalls([])
      setIsStreamingReasoningExpanded(false)
    }
  }

  const handleMarkToolFailed = async (toolCallId: string, error: string) => {
    if (!currentSessionId) return

    const session = sessions.find(s => s.id === currentSessionId)
    if (!session) return

    const updatedSession = {
      ...session,
      messages: session.messages.map(msg => {
        const agentMsg = msg as AgentMessage
        if (agentMsg.toolCallExecutions) {
          return {
            ...agentMsg,
            toolCallExecutions: agentMsg.toolCallExecutions.map(exec =>
              exec.toolCall.id === toolCallId
                ? { ...exec, status: 'failed' as const, error, timestamp: Date.now() }
                : exec
            )
          }
        }
        return msg
      }),
      updatedAt: Date.now()
    }

    try {
      await dbManager.saveSession(updatedSession)
      setSessions(prev => prev.map(s =>
        s.id === currentSessionId ? updatedSession : s
      ))
    } catch (error) {
      console.error('Failed to save tool error:', error)
    }

    // Find the actual function name from the tool call
    let functionName = 'tool_error'
    const lastMessage = session.messages[session.messages.length - 1] as AgentMessage
    if (lastMessage?.toolCalls) {
      const toolCall = lastMessage.toolCalls.find(tc => tc.id === toolCallId)
      if (toolCall?.function?.name) {
        functionName = toolCall.function.name
      }
    }

    // Add tool error message according to OpenAI API format
    const toolMessage: Message = {
      id: generateId(),
      role: 'tool',
      content: `Error: ${error}`,
      timestamp: Date.now(),
      tool_call_id: toolCallId,
      name: functionName
    }

    // Update session with tool error message
    const sessionWithToolError = {
      ...updatedSession,
      messages: [...updatedSession.messages, toolMessage],
      updatedAt: Date.now()
    }

    try {
      await dbManager.saveSession(sessionWithToolError)
      setSessions(prev => prev.map(s =>
        s.id === currentSessionId ? sessionWithToolError : s
      ))

      // Continue conversation with AI after tool failure
      await continueConversationAfterTool(sessionWithToolError)
    } catch (error) {
      console.error('Failed to save tool error and continue conversation:', error)
    }
  }



  // Check if current model is properly configured
  const currentModelConfig = getCurrentModelConfig()
  const isConfigured = currentModelConfig.endpoint.trim() && (currentModelConfig.apiKey.trim() || !currentModelConfig.endpoint.includes('openai.com'))

  // No automatic session creation - sessions are created when user sends first message

  // Prevent hydration issues by not rendering until mounted
  if (!isMounted) {
    return null
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Session Manager */}
      <SessionManager
        sessions={sessions}
        currentSessionId={currentSessionId}
        agents={agents}
        isNewChatDisabled={showNewChatOverlay}
        onSessionSelect={handleSessionSelect}
        onSessionDelete={deleteSession}
        onSessionRename={renameSession}
        onNewChat={createNewSession}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-[800px]">
        {showNewChatOverlay ? (
          /* New Chat Overlay */
          <NewChatOverlay
            agents={agents}
            currentAgentId={currentAgentId}
            onSendMessage={handleOverlaySendMessage}
            onCreateAgent={() => setShowAgentModal(true)}
            onAgentSelect={setCurrentAgentId}
            shouldFocus={showNewChatOverlay}
            tools={tools}
          />
        ) : (
          <>
            {/* Chat Controls */}
            <ChatControls
              agents={agents}
              currentAgentId={currentAgentId}
              tools={tools}
              hasMessages={!!(currentSession?.messages.length)}
              apiConfig={config}
              onAgentSelect={handleAgentSelect}
              onAgentInstructionUpdate={handleAgentInstructionUpdate}
              onAgentToolsUpdate={handleAgentToolsUpdate}
              onCreateAgent={() => setShowAgentModal(true)}
              onSystemPromptEdit={() => setShowSystemPromptModal(true)}
            />

            {/* Messages */}
            <ChatMessages
              messages={currentSession?.messages || []}
              isLoading={isLoading}
              streamingContent={streamingContent}
              streamingReasoningContent={streamingReasoningContent}
              isStreamingReasoningExpanded={isStreamingReasoningExpanded}
              streamingToolCalls={streamingToolCalls}
              expandedReasoningMessages={expandedReasoningMessages}
              isInActiveConversation={isInActiveConversation}
              reasoningDuration={reasoningDuration}
              formatReasoningDuration={formatReasoningDuration}
              currentAgent={currentAgentWithTools}
              tools={tools}
              scrollToBottomTrigger={scrollToBottomTrigger}
              onProvideToolResult={handleProvideToolResult}
              onMarkToolFailed={handleMarkToolFailed}
              onRetryMessage={handleRetryMessage}
              onDeleteMessage={handleDeleteMessage}
              onEditMessage={handleEditMessage}
              onToggleReasoningExpansion={toggleReasoningExpansion}
              onToggleStreamingReasoningExpansion={() => setIsStreamingReasoningExpanded(!isStreamingReasoningExpanded)}
            />

            {/* Input */}
            <ChatInput
              ref={chatInputRef}
              onSendMessage={handleSendMessage}
              isLoading={isLoading}
              onStop={handleStop}
              disabled={!isConfigured}
              currentAgent={currentAgentWithTools}
              tools={tools}
              selectedToolIds={selectedToolIds}
              onToolsChange={setSelectedToolIds}
            />
          </>
        )}
      </div>

      {/* Accordion Panel */}
      <AccordionPanel
        config={config}
        agents={agents}
        tools={tools}
        onConfigChange={setConfig}
        onAgentCreate={() => setShowAgentModal(true)}
        onAgentUpdate={updateAgent}
        onAgentDelete={deleteAgent}
        onAgentReorder={reorderAgents}
        onToolCreate={createTool}
        onToolUpdate={(tool: Tool) => updateTool(tool.id, tool)}
        onToolDelete={deleteTool}
        onExport={() => setShowExportModal(true)}
        onImport={() => setShowImportModal(true)}
      />

      {/* Modals */}
      <AgentFormModal
        isOpen={showAgentModal}
        onClose={() => setShowAgentModal(false)}
        tools={tools}
        onAgentCreate={createAgent}
        onToolCreate={createTool}
      />



      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        agents={agents}
        tools={tools}
      />

      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImport}
        existingAgents={agents}
        existingTools={tools}
      />

      <SystemPromptModal
        isOpen={showSystemPromptModal}
        onClose={() => setShowSystemPromptModal(false)}
        initialPrompt={currentSession?.systemPrompt || config.systemPrompt}
        onSave={handleSystemPromptSave}
      />
    </div>
  )
}
