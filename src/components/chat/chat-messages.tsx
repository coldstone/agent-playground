'use client'

import React, { useEffect, useRef, useState } from 'react'
import { Message as MessageType, AgentMessage, ToolCall, Agent, Tool, Authorization } from '@/types'
import { formatTimestamp } from '@/lib/utils'
import { Message } from './message'
import { ToolCallDisplay } from '@/components/tools'
import { StreamingContent, MessageContent } from '@/components/markdown'
import { Atom, Bot, Text, Code, Trash2, Brain, Cpu, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip } from '@/components/ui/tooltip'
import { useSmartScroll } from '@/hooks/use-smart-scroll'

// Agent with resolved tools for display purposes
type AgentWithTools = Omit<Agent, 'tools'> & {
  tools: Tool[]
}

// Define MergedMessage type for TypeScript
interface MergedMessage {
  id: string
  role: 'assistant'
  content: string
  timestamp: number
  messages: AgentMessage[]
  totalUsage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
  provider?: string
  model?: string
  isMerged: true
}

interface ChatMessagesProps {
  messages: (MessageType | AgentMessage)[]
  isLoading: boolean
  showAIMessageBox?: boolean // Add prop to control AI message box display
  streamingContent?: string
  streamingReasoningContent?: string
  isStreamingReasoningExpanded?: boolean
  streamingToolCalls?: ToolCall[]
  expandedReasoningMessages?: Set<string>
  isInActiveConversation?: boolean
  reasoningDuration?: number | null
  formatReasoningDuration?: (durationMs: number) => string
  currentAgent?: AgentWithTools | null
  tools?: Tool[]
  authorizations?: Authorization[]
  scrollToBottomTrigger?: number // Add trigger to force scroll to bottom
  scrollToTopTrigger?: number // Add trigger to force scroll to top
  forceScrollTrigger?: number // Add trigger for user message send
  onShowScrollToBottomChange?: (show: boolean) => void // Callback for scroll to bottom button visibility
  onScrollToBottomClick?: () => void // Callback for scroll to bottom button click
  onShowScrollToTopChange?: (show: boolean) => void // Callback for scroll to top button visibility
  onScrollToTopClick?: () => void // Callback for scroll to top button click
  onProvideToolResult?: (toolCallId: string, result: string) => void
  onMarkToolFailed?: (toolCallId: string, error: string) => void
  onRetryMessage?: (messageId: string) => void
  onDeleteMessage?: (messageId: string) => void
  onEditMessage?: (messageId: string, newContent: string) => void
  onToggleReasoningExpansion?: (messageId: string) => void
  onToggleStreamingReasoningExpansion?: () => void
  onScrollToBottom?: () => void
  autoMode?: boolean
}

export function ChatMessages({
  messages,
  isLoading,
  showAIMessageBox = false,
  streamingContent,
  streamingReasoningContent,
  isStreamingReasoningExpanded = false,
  streamingToolCalls,
  expandedReasoningMessages = new Set(),
  isInActiveConversation = false,
  reasoningDuration,
  formatReasoningDuration,
  currentAgent,
  tools = [],
  authorizations = [],
  scrollToBottomTrigger,
  scrollToTopTrigger,
  forceScrollTrigger,
  onProvideToolResult,
  onMarkToolFailed,
  onRetryMessage,
  onDeleteMessage,
  onEditMessage,
  onToggleReasoningExpansion,
  onToggleStreamingReasoningExpansion,
  onScrollToBottom,
  onShowScrollToBottomChange,
  onScrollToBottomClick,
  onShowScrollToTopChange,
  onScrollToTopClick,
  autoMode = false
}: ChatMessagesProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const prevToolCallsLengthRef = useRef(0)

  // 监听streamingToolCalls变化，当Tool Call卡片出现时立即滚动到底部
  useEffect(() => {
    if (streamingToolCalls && streamingToolCalls.length > 0) {
      // 当从没有tool calls变为有tool calls，或者tool calls数量增加时，触发滚动
      if (prevToolCallsLengthRef.current === 0 || streamingToolCalls.length > prevToolCallsLengthRef.current) {
        // 使用setTimeout确保Tool Call卡片DOM渲染完成
        setTimeout(() => {
          onScrollToBottom?.()
        }, 100)
      }
      prevToolCallsLengthRef.current = streamingToolCalls.length
    } else {
      prevToolCallsLengthRef.current = 0
    }
  }, [streamingToolCalls, onScrollToBottom])

  // 监听合并消息的流式内容变化，确保在Auto模式下流式内容开始时正确滚动
  useEffect(() => {
    if (autoMode && isLoading && streamingContent) {
      // 在Auto模式下，当流式内容开始时，确保滚动到底部
      const timer = setTimeout(() => {
        onScrollToBottom?.()
      }, 50)
      
      return () => clearTimeout(timer)
    }
  }, [autoMode, isLoading, streamingContent, onScrollToBottom])

  // 监听scrollToTopTrigger变化，滚动到顶部
  useEffect(() => {
    if (scrollToTopTrigger && scrollToTopTrigger > 0) {
      const container = containerRef.current
      if (container) {
        container.scrollTo({
          top: 0,
          behavior: 'smooth'
        })
      }
    }
  }, [scrollToTopTrigger])

  // 使用智能滚动控制
  const { isAutoScrollEnabled, isUserScrolling, showScrollToBottom, showScrollToTop, scrollToBottom, scrollToTop } = useSmartScroll({
    dependencies: [messages, streamingContent, streamingReasoningContent, streamingToolCalls],
    containerRef,
    threshold: 100,
    isStreaming: !!(streamingContent || streamingReasoningContent || isLoading),
    forceScrollTrigger,
    scrollToBottomTrigger
  })

  // 通知父组件滚动到底部按钮的显示状态
  React.useEffect(() => {
    onShowScrollToBottomChange?.(showScrollToBottom)
  }, [showScrollToBottom, onShowScrollToBottomChange])

  // 通知父组件滚动到顶部按钮的显示状态
  React.useEffect(() => {
    onShowScrollToTopChange?.(showScrollToTop)
  }, [showScrollToTop, onShowScrollToTopChange])

  // 处理滚动到底部点击
  const handleScrollToBottomClick = React.useCallback(() => {
    scrollToBottom()
    onScrollToBottomClick?.()
  }, [scrollToBottom, onScrollToBottomClick])

  // 处理滚动到顶部点击
  const handleScrollToTopClick = React.useCallback(() => {
    scrollToTop()
    onScrollToTopClick?.()
  }, [scrollToTop, onScrollToTopClick])

  // Function to group consecutive AI messages with tool calls for display
  const getDisplayMessages = () => {
    const filteredMessages = messages.filter(msg => {
      // Always filter out system messages
      if (msg.role === 'system') return false
      
      // In auto mode, hide tool result messages to create a cleaner conversation flow
      if (autoMode && msg.role === 'tool') return false
      
      return true
    })

    if (!autoMode) {
      return filteredMessages
    }

    // In auto mode, group consecutive assistant messages into merged groups
    const groupedMessages: (MessageType | AgentMessage | MergedMessage)[] = []
    let i = 0

    while (i < filteredMessages.length) {
      const message = filteredMessages[i]
      
      if (message.role === 'assistant') {
        const agentMessage = message as AgentMessage
        
        // Check if this message has tool calls
        if (agentMessage.toolCalls && agentMessage.toolCalls.length > 0) {
          // Start a merged group
          const mergedGroup: MergedMessage = {
            id: `merged_${agentMessage.id}`,
            role: 'assistant',
            content: '',
            timestamp: agentMessage.timestamp,
            messages: [agentMessage],
            totalUsage: {
              prompt_tokens: agentMessage.usage?.prompt_tokens || 0,
              completion_tokens: agentMessage.usage?.completion_tokens || 0,
              total_tokens: agentMessage.usage?.total_tokens || 0
            },
            provider: agentMessage.provider,
            model: agentMessage.model,
            isMerged: true
          }
          
          i++
          
          // Look for consecutive assistant messages to merge
          while (i < filteredMessages.length && filteredMessages[i].role === 'assistant') {
            const nextAgentMessage = filteredMessages[i] as AgentMessage
            mergedGroup.messages.push(nextAgentMessage)
            
            // Accumulate token usage
            if (nextAgentMessage.usage) {
              mergedGroup.totalUsage.prompt_tokens += nextAgentMessage.usage.prompt_tokens || 0
              mergedGroup.totalUsage.completion_tokens += nextAgentMessage.usage.completion_tokens || 0
              mergedGroup.totalUsage.total_tokens += nextAgentMessage.usage.total_tokens || 0
            }
            
            i++
          }
          
          groupedMessages.push(mergedGroup)
        } else {
          // Regular assistant message without tool calls
          groupedMessages.push(agentMessage)
          i++
        }
      } else {
        // Non-assistant message
        groupedMessages.push(message)
        i++
      }
    }

    return groupedMessages
  }

  const displayMessages = getDisplayMessages()

  return (
    <div ref={containerRef} className="flex-1 overflow-y-auto p-4 space-y-4 min-w-0">
      {displayMessages.length === 0 ? (
        <div className="flex items-center justify-center h-full text-center">
          <div className="space-y-4">
            <div className="flex justify-center">
              <img
                src="/logo.svg"
                alt="Agent Playground Logo"
                className="w-32 h-32 opacity-40"
              />
            </div>
            <div>
              {currentAgent ? (
                <>
                  <h3 className="text-lg font-medium">{currentAgent.name}</h3>
                  <p className="text-muted-foreground">
                    {currentAgent.description || 'Ready to assist you'}
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-medium">Welcome to Agent Playground</h3>
                  <p className="text-muted-foreground">
                    Configure your LLM settings and start chatting with AI agents
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          {displayMessages.map((message, index) => {
            // Check if this is a merged message
            if ('isMerged' in message && message.isMerged) {
              const mergedMessage = message as MergedMessage
              const isLastMergedGroup = autoMode && index === displayMessages.length - 1 && isLoading
              return (
                <MergedMessageDisplay
                  key={message.id}
                  mergedMessage={mergedMessage}
                  tools={tools}
                  agent={currentAgent ? { ...currentAgent, tools: currentAgent.tools.map(t => t.id) } : undefined}
                  authorizations={authorizations}
                  expandedReasoningMessages={expandedReasoningMessages}
                  isInActiveConversation={isInActiveConversation}
                  reasoningDuration={reasoningDuration}
                  formatReasoningDuration={formatReasoningDuration}
                  onProvideToolResult={onProvideToolResult}
                  onMarkToolFailed={onMarkToolFailed}
                  onRetryMessage={onRetryMessage}
                  onDeleteMessage={onDeleteMessage}
                  onEditMessage={onEditMessage}
                  onToggleReasoningExpansion={onToggleReasoningExpansion}
                  onToggleStreamingReasoningExpansion={onToggleStreamingReasoningExpansion}
                  onScrollToBottom={onScrollToBottom}
                  autoMode={autoMode}
                  isLastMergedGroup={isLastMergedGroup}
                  isStreaming={isLastMergedGroup}
                  streamingContent={isLastMergedGroup ? streamingContent : undefined}
                  streamingReasoningContent={isLastMergedGroup ? streamingReasoningContent : undefined}
                  isStreamingReasoningExpanded={isLastMergedGroup ? isStreamingReasoningExpanded : false}
                  streamingToolCalls={isLastMergedGroup ? streamingToolCalls : undefined}
                />
              )
            } else {
              // Regular message
              return (
                <Message
                  key={message.id}
                  message={message}
                  tools={tools}
                  agent={currentAgent ? { ...currentAgent, tools: currentAgent.tools.map(t => t.id) } : undefined}
                  authorizations={authorizations}
                  isReasoningExpanded={expandedReasoningMessages.has(message.id)}
                  isInActiveConversation={isInActiveConversation}
                  reasoningDuration={reasoningDuration}
                  formatReasoningDuration={formatReasoningDuration}
                  onProvideToolResult={onProvideToolResult}
                  onMarkToolFailed={onMarkToolFailed}
                  onRetryMessage={onRetryMessage}
                  onDeleteMessage={onDeleteMessage}
                  onEditMessage={onEditMessage}
                  onToggleReasoningExpansion={onToggleReasoningExpansion}
                  onScrollToBottom={onScrollToBottom}
                  autoMode={autoMode}
                />
              )
            }
          })}
          
          {/* AI message box - unified for all states */}
          {/* Show AI message box in non-auto mode, or in auto mode when there's no last merged group to show streaming content in */}
          {isLoading && showAIMessageBox && (!autoMode || (autoMode && !displayMessages.some((msg, index) => 
            'isMerged' in msg && msg.isMerged && index === displayMessages.length - 1
          ))) && (
            <div className="flex gap-3 p-4 rounded-lg border bg-green-50 border-green-200">
              <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-green-600 bg-white border">
                <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-green-600">Assistant</span>
                  <span className="text-xs text-muted-foreground">
                    {streamingToolCalls?.length ? 'Calling tools...' :
                     streamingReasoningContent && !streamingContent ? 'Thinking...' :
                     streamingContent ? 'Typing...' : 'Thinking...'}
                  </span>
                </div>

                {/* Streaming reasoning content */}
                {streamingReasoningContent && (
                  <div className="border border-gray-200 bg-gray-50 rounded-md mb-3">
                    <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
                      <div className="flex items-center gap-2">
                        <Atom className="w-4 h-4 text-gray-400" />
                        <span className="text-xs text-gray-600 font-medium">
                          Thoughts
                          {reasoningDuration && formatReasoningDuration && (
                            <span className="text-gray-400"> ({formatReasoningDuration(reasoningDuration)})</span>
                          )}
                        </span>
                      </div>
                      <button
                        onClick={onToggleStreamingReasoningExpansion}
                        className="text-xs text-gray-400 hover:text-gray-600 transition-colors p-1"
                      >
                        {isStreamingReasoningExpanded ? (
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        ) : (
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        )}
                      </button>
                    </div>
                    {(isInActiveConversation || isStreamingReasoningExpanded) && (
                      <div className="p-3">
                        <div className="text-sm text-gray-500 leading-snug">
                          <div className="relative">
                            <StreamingContent
                              content={streamingReasoningContent}
                              isStreaming={true}
                              showToggle={false}
                              className="min-w-0"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Streaming content */}
                {streamingContent && (
                  <div className="min-w-0 overflow-hidden">
                    <StreamingContent
                      content={streamingContent}
                      isStreaming={true}
                      showToggle={true}
                      className="min-w-0"
                    />
                  </div>
                )}

                {/* Streaming tool calls */}
                {streamingToolCalls && streamingToolCalls.length > 0 && (
                  <div className="space-y-3 mt-4">
                    {streamingToolCalls.map((toolCall, index) => (
                      <ToolCallDisplay
                        key={`streaming-${toolCall.id}-${index}`}
                        toolCall={toolCall}
                        execution={undefined}
                        agent={currentAgent ? { ...currentAgent, tools: currentAgent.tools.map(t => t.id) } : undefined}
                        authorizations={authorizations}
                        onProvideResult={() => {}}
                        onMarkFailed={() => {}}
                        isStreaming={true}
                        autoMode={autoMode}
                        isCollapsed={autoMode}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// Component to display merged messages (multiple AI responses combined)
interface MergedMessageDisplayProps {
  mergedMessage: MergedMessage
  tools: Tool[]
  agent?: Agent
  authorizations: Authorization[]
  expandedReasoningMessages: Set<string>
  isInActiveConversation: boolean
  reasoningDuration: number | null | undefined
  formatReasoningDuration?: (durationMs: number) => string
  onProvideToolResult?: (toolCallId: string, result: string) => void
  onMarkToolFailed?: (toolCallId: string, error: string) => void
  onRetryMessage?: (messageId: string) => void
  onDeleteMessage?: (messageId: string) => void
  onEditMessage?: (messageId: string, newContent: string) => void
  onToggleReasoningExpansion?: (messageId: string) => void
  onToggleStreamingReasoningExpansion?: () => void
  onScrollToBottom?: () => void
  autoMode: boolean
  // Streaming content props (only for the last merged group in auto mode)
  isLastMergedGroup?: boolean
  isStreaming?: boolean
  streamingContent?: string
  streamingReasoningContent?: string
  isStreamingReasoningExpanded?: boolean
  streamingToolCalls?: ToolCall[]
}

function MergedMessageDisplay({ 
  mergedMessage, 
  tools, 
  agent, 
  authorizations,
  expandedReasoningMessages,
  isInActiveConversation,
  reasoningDuration,
  formatReasoningDuration,
  onProvideToolResult,
  onMarkToolFailed,
  onRetryMessage,
  onDeleteMessage,
  onEditMessage,
  onToggleReasoningExpansion,
  onToggleStreamingReasoningExpansion,
  onScrollToBottom,
  autoMode,
  isLastMergedGroup = false,
  isStreaming = false,
  streamingContent,
  streamingReasoningContent,
  isStreamingReasoningExpanded = false,
  streamingToolCalls
}: MergedMessageDisplayProps) {
  const [showMarkdown, setShowMarkdown] = useState(true)

  // Delete all messages in the merged group
  const handleDeleteMergedGroup = () => {
    if (onDeleteMessage) {
      // Delete all messages in the merged group
      mergedMessage.messages.forEach(message => {
        onDeleteMessage(message.id)
      })
    }
  }

  const getModelIcon = (provider?: string) => {
    if (!provider) return <Cpu className="w-3 h-3" />

    const providerLower = provider.toLowerCase()
    if (providerLower.includes('openai')) return <Brain className="w-3 h-3" />
    if (providerLower.includes('deepseek')) return <Atom className="w-3 h-3" />
    if (providerLower.includes('claude') || providerLower.includes('anthropic')) return <Zap className="w-3 h-3" />
    return <Cpu className="w-3 h-3" />
  }

  const getModelTooltip = (provider?: string, model?: string) => {
    if (!provider || !model) return 'Unknown model'
    return `${provider}: ${model}`
  }

  return (
    <div className="group flex gap-3 p-4 rounded-lg border bg-green-50 border-green-200 min-w-0">
      <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-green-600 bg-white border">
        <Bot className="w-4 h-4" />
      </div>

      <div className="flex-1 space-y-2 min-w-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm text-green-600">Assistant</span>
            <span className="text-xs text-muted-foreground">
              {formatTimestamp(mergedMessage.timestamp)}
            </span>
          </div>
          
          {/* Action buttons */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {/* Markdown toggle button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowMarkdown(!showMarkdown)}
              className="h-6 w-6 p-0 flex items-center justify-center flex-shrink-0"
              title={showMarkdown ? 'Show raw text' : 'Show markdown'}
            >
              {showMarkdown ? (
                <Code className="w-3 h-3 flex-shrink-0" />
              ) : (
                <Text className="w-3 h-3 flex-shrink-0" />
              )}
            </Button>

            {/* Delete button for merged group */}
            {onDeleteMessage && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDeleteMergedGroup}
                className="h-6 w-6 p-0 text-destructive hover:text-destructive flex items-center justify-center flex-shrink-0"
                title="Delete merged conversation"
              >
                <Trash2 className="w-3 h-3 flex-shrink-0" />
              </Button>
            )}
          </div>
        </div>

        {/* Render all merged messages */}
        {mergedMessage.messages.map((message: AgentMessage, index: number) => (
          <div key={message.id} className="space-y-3">
            {/* Reasoning content - only show for assistant messages with reasoning */}
            {message.reasoningContent && (
              <div className="border border-gray-200 bg-gray-50 rounded-md mb-3">
                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 hover:cursor-pointer"
                    onClick={() => onToggleReasoningExpansion?.(message.id)}>
                  <div className="flex items-center gap-2">
                    <Atom className="w-4 h-4 text-gray-400" />
                    <span className="text-xs text-gray-600 font-medium">
                      Thoughts
                      {formatReasoningDuration && message.reasoningDuration && (
                        <span className="text-gray-400"> ({formatReasoningDuration(message.reasoningDuration)})</span>
                      )}
                    </span>
                  </div>
                  <button className="text-xs text-gray-400 hover:text-gray-600 transition-colors p-1">
                    {expandedReasoningMessages.has(message.id) ? (
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    ) : (
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    )}
                  </button>
                </div>
                {expandedReasoningMessages.has(message.id) && (
                  <div className="p-3">
                    <div className="text-sm text-gray-500 leading-snug">
                      <MessageContent
                        content={message.reasoningContent}
                        className="min-w-0"
                        showToggle={false}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Message content */}
            {message.content && (
              showMarkdown ? (
                <MessageContent
                  content={message.content}
                  className="min-w-0"
                  showToggle={false}
                />
              ) : (
                <pre className="whitespace-pre-wrap text-gray-700 dark:text-gray-300 font-mono text-sm leading-relaxed min-w-0 overflow-x-auto">
                  {message.content}
                </pre>
              )
            )}

            {/* Tool Calls for this message */}
            {message.toolCalls && message.toolCalls.length > 0 && (
              <div className="space-y-3">
                {message.toolCalls
                  .filter((toolCall: ToolCall) =>
                    toolCall.function?.arguments && toolCall.function.arguments.trim() !== ''
                  )
                  .map((toolCall: ToolCall) => {
                    // Handle backward compatibility
                    let execution = message.toolCallExecutions?.find(
                      exec => exec.toolCall.id === toolCall.id
                    )
                    
                    if (!execution && message.toolCalls) {
                      execution = {
                        id: toolCall.id + '_compat',
                        toolCall: toolCall,
                        status: 'completed' as const,
                        timestamp: message.timestamp
                      }
                    }
                    
                    const tool = tools.find(t => t.name === toolCall.function.name)

                    return (
                      <ToolCallDisplay
                        key={toolCall.id}
                        toolCall={toolCall}
                        execution={execution}
                        tool={tool}
                        agent={agent}
                        authorizations={authorizations}
                        onProvideResult={onProvideToolResult || (() => {})}
                        onMarkFailed={onMarkToolFailed || (() => {})}
                        onScrollToBottom={onScrollToBottom}
                        autoMode={autoMode}
                        isCollapsed={autoMode}
                        inMergedCard={true}
                      />
                    )
                  })}
              </div>
            )}
          </div>
        ))}

        {/* Streaming content for the last merged group in auto mode */}
        {isLastMergedGroup && isStreaming && (
          <>
            {/* Streaming reasoning content */}
            {streamingReasoningContent && (
              <div className="border border-gray-200 bg-gray-50 rounded-md mb-3">
                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <Atom className="w-4 h-4 text-gray-400" />
                    <span className="text-xs text-gray-600 font-medium">
                      Thoughts
                      {reasoningDuration && formatReasoningDuration && (
                        <span className="text-gray-400"> ({formatReasoningDuration(reasoningDuration)})</span>
                      )}
                    </span>
                  </div>
                  <button
                    onClick={onToggleStreamingReasoningExpansion}
                    className="text-xs text-gray-400 hover:text-gray-600 transition-colors p-1"
                  >
                    {isStreamingReasoningExpanded ? (
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    ) : (
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    )}
                  </button>
                </div>
                {(isInActiveConversation || isStreamingReasoningExpanded) && (
                  <div className="p-3">
                    <div className="text-sm text-gray-500 leading-snug">
                      <div className="relative">
                        <StreamingContent
                          content={streamingReasoningContent}
                          isStreaming={true}
                          showToggle={false}
                          className="min-w-0"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Streaming text content */}
            {streamingContent && (
              <div className="min-w-0 overflow-hidden">
                <StreamingContent
                  content={streamingContent}
                  isStreaming={true}
                  showToggle={true}
                  className="min-w-0"
                />
              </div>
            )}

            {/* Streaming tool calls */}
            {streamingToolCalls && streamingToolCalls.length > 0 && (
              <div className="space-y-3 mt-4">
                {streamingToolCalls.map((toolCall, index) => (
                  <ToolCallDisplay
                    key={`streaming-${toolCall.id}-${index}`}
                    toolCall={toolCall}
                    execution={undefined}
                    agent={agent}
                    authorizations={authorizations}
                    onProvideResult={() => {}}
                    onMarkFailed={() => {}}
                    isStreaming={true}
                    autoMode={autoMode}
                    isCollapsed={autoMode}
                    inMergedCard={true}
                  />
                ))}
              </div>
            )}

            {/* Streaming status indicator */}
            {!streamingContent && !streamingReasoningContent && !streamingToolCalls?.length && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                <span>Thinking...</span>
              </div>
            )}
          </>
        )}

        {/* Combined token usage */}
        {mergedMessage.totalUsage && (
          <div className="mt-3 text-xs text-muted-foreground flex items-center gap-2">
            <span>
              {mergedMessage.totalUsage.prompt_tokens} prompt + {mergedMessage.totalUsage.completion_tokens} completion = {mergedMessage.totalUsage.total_tokens} tokens
            </span>
            <Tooltip content={getModelTooltip(mergedMessage.provider, mergedMessage.model)}>
              <div className="flex items-center justify-center w-4 h-4 text-gray-400 hover:text-gray-600 transition-colors">
                {getModelIcon(mergedMessage.provider)}
              </div>
            </Tooltip>
          </div>
        )}
      </div>
    </div>
  )
}
