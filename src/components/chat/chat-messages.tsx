'use client'

import React, { useEffect, useRef } from 'react'
import { Message as MessageType, AgentMessage, ToolCall, Agent, Tool, Authorization } from '@/types'
import { Message } from './message'
import { ToolCallDisplay } from '@/components/tools'
import { StreamingContent } from '@/components/markdown'
import { Atom } from 'lucide-react'
import { useSmartScroll } from '@/hooks/use-smart-scroll'

// Agent with resolved tools for display purposes
type AgentWithTools = Omit<Agent, 'tools'> & {
  tools: Tool[]
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
  onScrollToTopClick
}: ChatMessagesProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const prevToolCallsLengthRef = useRef(0)

  // 监听streamingToolCalls变化，当Tool Call卡片出现时立即滚动到底部
  useEffect(() => {
    if (streamingToolCalls && streamingToolCalls.length > 0) {
      // 当从没有tool calls变为有tool calls，或者tool calls数量增加时，触发滚动
      if (prevToolCallsLengthRef.current === 0 || streamingToolCalls.length > prevToolCallsLengthRef.current) {
        onScrollToBottom?.()
      }
      prevToolCallsLengthRef.current = streamingToolCalls.length
    } else {
      prevToolCallsLengthRef.current = 0
    }
  }, [streamingToolCalls, onScrollToBottom])

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
    dependencies: [messages, streamingContent, streamingReasoningContent],
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

  const displayMessages = messages.filter(msg => msg.role !== 'system')

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
          {displayMessages.map((message) => (
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
            />
          ))}
          
          {/* AI message box - unified for all states */}
          {isLoading && showAIMessageBox && (
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
                    {!isInActiveConversation && (
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
                    )}
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
