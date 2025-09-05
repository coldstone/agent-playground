'use client'

import React, { useState } from 'react'
import { Message as MessageType, AgentMessage, Tool, Agent, Authorization, ToolCallExecution } from '@/types'
import { formatTimestamp } from '@/lib/utils'
import { ToolCallDisplay } from '@/components/tools'
import { MessageContent } from '@/components/markdown'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip } from '@/components/ui/tooltip'
import { User, Bot, Settings, Wrench, RefreshCw, Trash2, Edit2, Check, X, Atom, Brain, Cpu, Zap, Text, Code, Copy, ChevronDown, ChevronUp } from 'lucide-react'

// Code block component for displaying tool results
function CodeBlock({ content, language = 'json' }: { content: string; language?: string }) {
  const [copied, setCopied] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy text: ', err)
    }
  }

  // Try to format JSON content
  const formatContent = (text: string) => {
    if (language === 'json') {
      try {
        const parsed = JSON.parse(text)
        return JSON.stringify(parsed, null, 2)
      } catch {
        return text
      }
    }
    return text
  }

  const formattedContent = formatContent(content)

  return (
    <div className="relative group">
      <div className="flex items-center justify-between bg-gray-800 text-gray-300 px-3 py-1.5 text-xs rounded-t-lg">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs uppercase tracking-wide">
            {language}
          </span>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-700 hover:bg-gray-600 transition-colors"
            title={isExpanded ? "Collapse code block" : "Expand code block"}
          >
            {isExpanded ? (
              <>
                <ChevronUp size={12} />
                <span className="text-xs">Collapse</span>
              </>
            ) : (
              <>
                <ChevronDown size={12} />
                <span className="text-xs">Expand</span>
              </>
            )}
          </button>
        </div>
        <button
          onClick={copyToClipboard}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-700 hover:bg-gray-600 transition-colors opacity-0 group-hover:opacity-100"
          title="Copy content"
        >
          {copied ? (
            <>
              <Check size={12} />
              <span className="text-xs">Copied</span>
            </>
          ) : (
            <>
              <Copy size={12} />
              <span className="text-xs">Copy</span>
            </>
          )}
        </button>
      </div>
      {isExpanded && (
        <pre className="bg-gray-900 text-gray-100 p-3 rounded-b-lg m-0 text-xs overflow-x-auto whitespace-pre-wrap break-words">
          <code>{formattedContent}</code>
        </pre>
      )}
    </div>
  )
}

interface MessageProps {
  message: MessageType | AgentMessage
  tools?: Tool[]
  agent?: Agent
  authorizations?: Authorization[]
  isReasoningExpanded?: boolean
  isInActiveConversation?: boolean
  reasoningDuration?: number | null
  formatReasoningDuration?: (durationMs: number) => string
  onProvideToolResult?: (toolCallId: string, result: string) => void
  onMarkToolFailed?: (toolCallId: string, error: string) => void
  onRetryMessage?: (messageId: string) => void
  onDeleteMessage?: (messageId: string) => void
  onEditMessage?: (messageId: string, newContent: string) => void
  onToggleReasoningExpansion?: (messageId: string) => void
  onScrollToBottom?: () => void
  autoMode?: boolean
}

export function Message({
  message,
  tools = [],
  agent,
  authorizations = [],
  isReasoningExpanded = false,
  isInActiveConversation = false,
  reasoningDuration,
  formatReasoningDuration,
  onProvideToolResult,
  onMarkToolFailed,
  onRetryMessage,
  onDeleteMessage,
  onEditMessage,
  onToggleReasoningExpansion,
  onScrollToBottom,
  autoMode = false
}: MessageProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState(message.content)
  const [showMarkdown, setShowMarkdown] = useState(true)
  const [isCopied, setIsCopied] = useState(false)


  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'
  const isTool = message.role === 'tool'
  const agentMessage = message as AgentMessage

  const handleStartEdit = () => {
    setEditContent(message.content)
    setIsEditing(true)
  }

  const handleSaveEdit = () => {
    if (editContent.trim() && onEditMessage) {
      onEditMessage(message.id, editContent.trim())
    }
    setIsEditing(false)
  }

  const handleCancelEdit = () => {
    setEditContent(message.content)
    setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSaveEdit()
    } else if (e.key === 'Escape') {
      handleCancelEdit()
    }
  }

  const handleCopyContent = async () => {
    try {
      let contentToCopy = message.content


      // If showing markdown, copy the formatted content
      // If showing raw text, copy the raw content
      if (showMarkdown) {
        // For markdown mode, we copy the raw markdown content
        // Users can paste it and it will render as markdown elsewhere
        contentToCopy = message.content
      } else {
        // For raw text mode, copy the raw content
        contentToCopy = message.content
      }

      await navigator.clipboard.writeText(contentToCopy)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy content: ', err)
    }
  }

  const getIcon = () => {
    if (isSystem) return <Settings className="w-4 h-4" />
    if (isUser) return <User className="w-4 h-4" />
    if (isTool) return <Wrench className="w-4 h-4" />
    return <Bot className="w-4 h-4" />
  }

  const getRoleColor = () => {
    if (isSystem) return 'text-orange-600'
    if (isUser) return 'text-blue-600'
    if (isTool) return 'text-purple-600'
    return 'text-green-600'
  }

  const getBgColor = () => {
    if (isSystem) return 'bg-orange-50 border-orange-200'
    if (isUser) return 'bg-blue-50 border-blue-200'
    if (isTool) return 'bg-purple-50 border-purple-200'
    return 'bg-green-50 border-green-200'
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
    <div className={`group flex gap-3 p-4 rounded-lg border ${getBgColor()} min-w-0`}>
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${getRoleColor()} bg-white border`}>
        {getIcon()}
      </div>
      <div className="flex-1 space-y-2 min-w-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`font-medium text-sm ${getRoleColor()}`}>
              {isTool ? `Tool Result (${message.name || 'unknown'})` : message.role.charAt(0).toUpperCase() + message.role.slice(1)}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatTimestamp(message.timestamp)}
            </span>
            {isTool && message.tool_call_id && (
              <span className="text-xs text-muted-foreground bg-purple-100 px-2 py-1 rounded">
                ID: {message.tool_call_id.slice(-8)}
              </span>
            )}
            {message.error && (
              <span className="text-xs text-red-600 bg-red-100 px-2 py-1 rounded">
                Error
              </span>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {/* Copy button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyContent}
              className="h-6 w-6 p-0 flex items-center justify-center flex-shrink-0"
              title="Copy content"
            >
              {isCopied ? (
                <Check className="w-3 h-3 flex-shrink-0 text-green-600" />
              ) : (
                <Copy className="w-3 h-3 flex-shrink-0" />
              )}
            </Button>

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

            {/* Edit button for user messages */}
            {message.role === 'user' && onEditMessage && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleStartEdit}
                className="h-6 w-6 p-0 flex items-center justify-center flex-shrink-0"
                title="Edit message"
              >
                <Edit2 className="w-3 h-3 flex-shrink-0" />
              </Button>
            )}

            {/* Retry button for assistant messages only (not tool results) */}
            {message.role === 'assistant' && onRetryMessage && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRetryMessage(message.id)}
                className="h-6 w-6 p-0 flex items-center justify-center flex-shrink-0"
                title={message.error ? "Retry failed request" : "Regenerate response"}
              >
                <RefreshCw className="w-3 h-3 flex-shrink-0" />
              </Button>
            )}

            {/* Delete button for all messages */}
            {onDeleteMessage && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDeleteMessage(message.id)}
                className="h-6 w-6 p-0 text-destructive hover:text-destructive flex items-center justify-center flex-shrink-0"
                title="Delete message"
              >
                <Trash2 className="w-3 h-3 flex-shrink-0" />
              </Button>
            )}
          </div>
        </div>

        {/* Message content - editing mode for user messages */}
        {isEditing && message.role === 'user' ? (
          <div className="space-y-3">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              onKeyDown={handleKeyDown}
              className="min-h-[80px] resize-none"
              placeholder="Edit your message..."
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSaveEdit}
                disabled={!editContent.trim()}
                className="h-8"
              >
                <Check className="w-3 h-3 mr-1" />
                Send
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCancelEdit}
                className="h-8"
              >
                <X className="w-3 h-3 mr-1" />
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Reasoning content - only show for assistant messages with reasoning */}
            {message.role === 'assistant' && agentMessage.reasoningContent && (
              <div className="border border-gray-200 bg-gray-50 rounded-md mb-3">
                {!isInActiveConversation && (
                  <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 hover:cursor-pointer"
                      onClick={() => onToggleReasoningExpansion?.(message.id)}>
                    <div className="flex items-center gap-2">
                      <Atom className="w-4 h-4 text-gray-400" />
                      <span className="text-xs text-gray-600 font-medium">
                        Thoughts
                        {agentMessage.reasoningDuration && formatReasoningDuration && (
                          <span className="text-gray-400"> ({formatReasoningDuration(agentMessage.reasoningDuration)})</span>
                        )}
                      </span>
                    </div>
                    <button
                      className="text-xs text-gray-400 hover:text-gray-600 transition-colors p-1"
                    >
                      {isReasoningExpanded ? (
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
                )}
                {(isInActiveConversation || isReasoningExpanded) && (
                  <div className="p-3">
                    <div className="text-sm text-gray-500 leading-snug">
                      <MessageContent
                        content={agentMessage.reasoningContent}
                        className="min-w-0"
                        showToggle={false}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tool Result messages use code block display */}
            {isTool ? (
              <CodeBlock content={message.content} language="json" />
            ) : showMarkdown ? (
              <MessageContent
                content={message.content}
                className="min-w-0"
                showToggle={false}
              />
            ) : (
              <pre className="whitespace-pre-wrap text-gray-700 dark:text-gray-300 font-mono text-sm leading-relaxed min-w-0 overflow-x-auto">
                {message.content}
              </pre>
            )}

            {/* Error message display - show below content for assistant messages */}
            {message.role === 'assistant' && message.error && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <X className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-red-800 mb-1">发生错误</div>
                    <div className="text-sm text-red-700 whitespace-pre-wrap break-words">
                      {message.error}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Tool Calls - only show tool calls with arguments */}
        {agentMessage.toolCalls && agentMessage.toolCalls.length > 0 && (
          <div className="space-y-3 mt-4">
            {agentMessage.toolCalls
              .filter(toolCall =>
                toolCall.function?.arguments && toolCall.function.arguments.trim() !== ''
              )
              .map((toolCall) => {
                // Handle backward compatibility: create execution if it doesn't exist
                let execution = agentMessage.toolCallExecutions?.find(
                  exec => exec.toolCall.id === toolCall.id
                )
                
                // For backward compatibility with old sessions that don't have toolCallExecutions
                if (!execution && agentMessage.toolCalls) {
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
                  />
                )
              })}
          </div>
        )}

        {/* Token Usage - only show for assistant messages with usage data */}
        {message.role === 'assistant' && agentMessage.usage && (
          <div className="mt-3 text-xs text-muted-foreground flex items-center gap-2">
            <span>
              {agentMessage.usage.prompt_tokens} prompt + {agentMessage.usage.completion_tokens} completion = {agentMessage.usage.total_tokens} tokens
            </span>
            <Tooltip content={getModelTooltip(agentMessage.provider, agentMessage.model)}>
              <div className="flex items-center justify-center w-4 h-4 text-gray-400 hover:text-gray-600 transition-colors">
                {getModelIcon(agentMessage.provider)}
              </div>
            </Tooltip>
          </div>
        )}
      </div>
    </div>
  )
}
