'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { ToolCall, ToolCallExecution, Tool, HTTPRequestConfig, Authorization, Agent } from '@/types'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatTimestamp } from '@/lib/utils'
import { getMergedHeaders, getEffectiveAuthorization, migrateAgentTools } from '@/lib/authorization'
import { Wrench as ToolIcon, Play, Check, X, Clock, AlertCircle, Globe, Send, Copy, ChevronDown, ChevronUp, Settings2 } from 'lucide-react'
import { useToast } from '@/components/ui/toast'

interface ToolCallDisplayProps {
  toolCall: ToolCall
  execution?: ToolCallExecution
  tool?: Tool
  agent?: Agent
  authorizations?: Authorization[]
  onProvideResult: (toolCallId: string, result: string) => void
  onMarkFailed: (toolCallId: string, error: string) => void
  isStreaming?: boolean
  onScrollToBottom?: () => void
  autoMode?: boolean
  isCollapsed?: boolean
  inMergedCard?: boolean
}
// Component for displaying tool result with collapsible functionality
function ResultDisplay({ content }: { content: string }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const preRef = useRef<HTMLPreElement>(null)
  const [needsToggle, setNeedsToggle] = useState(false)

  useEffect(() => {
    if (preRef.current) {
      // Check if content height exceeds 200px
      const scrollHeight = preRef.current.scrollHeight
      setNeedsToggle(scrollHeight > 200)
    }
  }, [content])
  
  return (
    <div className="mt-0 relative">
      <div className={`relative ${!isExpanded && needsToggle ? 'max-h-[200px] overflow-hidden' : ''}`}>
        <pre 
          ref={preRef}
          className="text-sm bg-transparent p-3 whitespace-pre-wrap break-all overflow-wrap-anywhere min-w-0 overflow-x-auto text-foreground"
        >
          {content}
        </pre>
        {!isExpanded && needsToggle && (
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-card to-transparent pointer-events-none" />
        )}
      </div>
      {needsToggle && (
        <div className="flex justify-center mt-4 mb-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-sm text-green-600 hover:text-green-700 cursor-pointer bg-transparent border-none"
          >
            {isExpanded ? 'Display Less' : 'Display More'}
          </button>
        </div>
      )}
    </div>
  )
}

export function ToolCallDisplay({
  toolCall,
  execution,
  tool,
  agent,
  authorizations = [],
  onProvideResult,
  onMarkFailed,
  isStreaming = false,
  onScrollToBottom,
  autoMode = false,
  isCollapsed = false,
  inMergedCard = false
}: ToolCallDisplayProps) {
  const { showToast, ToastContainer } = useToast()
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const [isProvidingResult, setIsProvidingResult] = useState(false)
  const [isProvidingError, setIsProvidingError] = useState(false)
  const [isRequestingHttp, setIsRequestingHttp] = useState(false)
  const [httpHeaders, setHttpHeaders] = useState<{ key: string; value: string }[]>([])
  const [httpUrl, setHttpUrl] = useState('')
  const [isManuallyExpanded, setIsManuallyExpanded] = useState(false)

  // Initialize HTTP configuration when tool or authorization changes
  const { mergedHeaders, httpRequestUrl } = useMemo(() => {
    if (tool?.httpRequest) {
      // Get effective authorization for this tool
      const toolBindings = agent ? migrateAgentTools(agent) : []
      const binding = toolBindings.find(b => b.toolId === tool.id)
      const effectiveAuth = getEffectiveAuthorization(tool, authorizations, binding)
      
      // Merge tool headers with authorization headers
      const headers = getMergedHeaders(tool, effectiveAuth)
      return {
        mergedHeaders: headers,
        httpRequestUrl: tool.httpRequest.url
      }
    }
    return {
      mergedHeaders: [],
      httpRequestUrl: ''
    }
  }, [tool, agent, authorizations])

  useEffect(() => {
    setHttpHeaders(mergedHeaders)
    setHttpUrl(httpRequestUrl)
  }, [mergedHeaders, httpRequestUrl])

  const handleProvideResult = () => {
    if (result.trim()) {
      onProvideResult(toolCall.id, result.trim())
      setResult('')
      setIsProvidingResult(false)
      // 触发滚动到底部
      onScrollToBottom?.()
    }
  }

  const handleProvideError = () => {
    if (error.trim()) {
      onMarkFailed(toolCall.id, error.trim())
      setError('')
      setIsProvidingError(false)
      // 触发滚动到底部
      onScrollToBottom?.()
    }
  }

  const handleCancel = () => {
    setResult('')
    setError('')
    setIsProvidingResult(false)
    setIsProvidingError(false)
    setIsRequestingHttp(false)
  }

  const handleHttpRequest = async () => {
    if (!tool?.httpRequest) return

    setIsRequestingHttp(true)
    try {
      // Parse arguments
      let parsedArguments: any = {}
      try {
        parsedArguments = JSON.parse(toolCall.function.arguments)
      } catch (e) {
        const errorMessage = 'Invalid arguments format'
        showToast(errorMessage, 'error')
        return
      }

      // Replace parameters in URL and headers
      let processedUrl = tool.httpRequest.url
      const processedHeaders: { [key: string]: string } = {}
      const remainingArguments = { ...parsedArguments }

      // Replace URL parameters
      const urlParams = processedUrl.match(/\{([^}]+)\}/g) || []
      for (const param of urlParams) {
        const paramName = param.slice(1, -1) // Remove { and }
        if (remainingArguments[paramName] !== undefined) {
          processedUrl = processedUrl.replace(param, String(remainingArguments[paramName]))
          delete remainingArguments[paramName]
        }
      }

      // Process headers
      for (const header of httpHeaders) {
        if (header.key && header.value) {
          let headerValue = header.value
          const headerParams = headerValue.match(/\{([^}]+)\}/g) || []
          for (const param of headerParams) {
            const paramName = param.slice(1, -1)
            if (remainingArguments[paramName] !== undefined) {
              headerValue = headerValue.replace(param, String(remainingArguments[paramName]))
              delete remainingArguments[paramName]
            }
          }
          processedHeaders[header.key] = headerValue
        }
      }

      // Prepare request data
      let requestData: any = null
      if (tool.httpRequest.method === 'GET') {
        // For GET requests, add remaining arguments as query parameters
        const queryParams = new URLSearchParams()
        for (const [key, value] of Object.entries(remainingArguments)) {
          queryParams.append(key, String(value))
        }
        if (queryParams.toString()) {
          processedUrl += (processedUrl.includes('?') ? '&' : '?') + queryParams.toString()
        }
      } else {
        // For other methods, use remaining arguments as request body
        requestData = remainingArguments
      }

      // Make the request through proxy
      const response = await fetch('/api/proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          method: tool.httpRequest.method,
          url: processedUrl,
          headers: processedHeaders,
          data: requestData
        })
      })

      const proxyResult = await response.json()

      if (response.ok) {
        // Success - provide the result
        const resultText = typeof proxyResult.data === 'string'
          ? proxyResult.data
          : JSON.stringify(proxyResult.data, null, 2)
        onProvideResult(toolCall.id, resultText)
        // 触发滚动到底部
        onScrollToBottom?.()
      } else {
        // Error - mark as failed
        const errorText = proxyResult.error || proxyResult.message || 'HTTP request failed'
        onMarkFailed(toolCall.id, errorText)
        // 触发滚动到底部
        onScrollToBottom?.()
      }
    } catch (error) {
      showToast('HTTP request failed.', 'error')
      onMarkFailed(toolCall.id, error instanceof Error ? error.message : 'Unknown error')
    } finally {
      setIsRequestingHttp(false)
    }
  }

  const getMainStatusIcon = () => {
    if (isStreaming) {
      return <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
    }
    if (!execution) return <Clock className="w-6 h-6 text-blue-600" />

    switch (execution.status) {
      case 'pending':
        return autoMode 
          ? <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          : <Clock className="w-6 h-6 text-blue-600" />
      case 'completed':
        return <Check className="w-6 h-6 text-green-600" />
      case 'failed':
        return <X className="w-6 h-6 text-red-600" />
      default:
        return <Clock className="w-6 h-6 text-gray-400" />
    }
  }

  const getStatusColor = () => {
    // In merged cards, use consistent subtle background colors
    if (inMergedCard) {
      if (isStreaming) return 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800'
      if (!execution) return 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800'

      switch (execution.status) {
        case 'pending':
          return 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800'
        case 'completed':
          return 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800'
        case 'failed':
          return 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30'
        default:
          return 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800'
      }
    }

    // Standalone tool calls - always use purple background
    if (isStreaming) return 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800'
    if (!execution) return 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800'

    switch (execution.status) {
      case 'pending':
        return 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800'
      case 'completed':
        return 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800'
      case 'failed':
        return 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30'
      default:
        return 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800'
    }
  }

  const getStatusTextColor = () => {
    if (!execution || execution.status !== 'failed') return 'text-muted-foreground'
    return 'text-red-600'
  }

  const getStatusText = () => {
    if (isStreaming) return 'Streaming arguments...'
    if (!execution) return 'Waiting for execution'

    switch (execution.status) {
      case 'pending':
        return 'Waiting for result'
      case 'completed':
        return execution.result ? 'Completed' : 'Completed (Legacy)'
      case 'failed':
        return 'Failed'
      default:
        return 'Unknown'
    }
  }

  let parsedArguments: any = {}
  let argumentsDisplay = toolCall.function.arguments

  if (isStreaming) {
    argumentsDisplay = toolCall.function.arguments
  } else {
    try {
      parsedArguments = JSON.parse(toolCall.function.arguments)
      argumentsDisplay = JSON.stringify(parsedArguments, null, 2)
    } catch (e) {
      argumentsDisplay = toolCall.function.arguments
    }
  }

  // Collapsed state for auto mode
  if (isCollapsed && !isManuallyExpanded) {
    return (
      <div className={`rounded-lg border p-4 ${getStatusColor()} min-w-0 w-full`}>
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-card border border-border">
            {getMainStatusIcon()}
          </div>

          <div className="flex-1 min-w-0">
          <div 
            className={`flex items-center justify-between ${autoMode ? 'cursor-pointer hover:bg-muted/60' : ''} rounded transition-all duration-200 -mx-1 px-1`}
            onClick={() => setIsManuallyExpanded(true)}
          >
            <div className="flex flex-col gap-1">
              <div className="text-xs text-muted-foreground">Tool Call</div>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-medium ${execution?.status === 'failed' ? 'text-red-600' : 'text-purple-600'}`}>
                  {toolCall.function.name}
                </span>
                <span className={`text-xs ${getStatusTextColor()}`}>
                  {getStatusText()}
                    {execution && (
                      <span className="ml-1">
                        • {formatTimestamp(execution.timestamp)}
                      </span>
                    )}
                  </span>
                </div>
              </div>
              
              {/* Expand indicator */}
              <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-muted-foreground transition-colors">
                <ChevronDown className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`rounded-lg border p-4 ${getStatusColor()} min-w-0 w-full`}>
      <div className="flex items-start gap-3 min-w-0">
        <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-card border border-border">
          {getMainStatusIcon()}
        </div>

        <div className="flex-1 space-y-3 min-w-0">
          <div 
          className={`flex items-center justify-between ${autoMode ? 'cursor-pointer hover:bg-muted/60' : ''} rounded transition-all duration-200 -mx-1 px-1`}
          onClick={isCollapsed && isManuallyExpanded ? () => setIsManuallyExpanded(false) : undefined}
        >
          <div className="flex flex-col gap-1">
            <div className="text-xs text-muted-foreground">Tool Call</div>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-medium ${execution?.status === 'failed' ? 'text-red-600' : 'text-purple-600'}`}>
                {toolCall.function.name}
              </span>
              <span className={`text-xs ${getStatusTextColor()}`}>
                {getStatusText()}
                  {execution && (
                    <span className="ml-1">
                      • {formatTimestamp(execution.timestamp)}
                    </span>
                  )}
                </span>
              </div>
            </div>
            {/* Collapse indicator for manually expanded cards */}
            {isCollapsed && isManuallyExpanded ? (
              <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-muted-foreground transition-colors">
                <ChevronUp className="w-4 h-4" />
              </div>
            ) : (
              <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-transparent">
                <ChevronUp className="w-4 h-4" />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="min-w-0">
            <div className="bg-orange-50 dark:bg-orange-950/50 px-3 py-2 rounded-t border border-border border-orange-100 dark:border-orange-900/30 flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-600">Parameters</span>
            </div>
            <pre className="text-sm bg-card p-3 rounded-b border border-t-0 border-border  border-orange-100 dark:border-orange-900/50 whitespace-pre-wrap break-all overflow-wrap-anywhere min-w-0 overflow-x-auto">
              {argumentsDisplay}
              {isStreaming && (
                <span className="inline-block w-2 h-4 bg-yellow-600 animate-pulse ml-1" />
              )}
            </pre>
          </div>

            {tool?.httpRequest && (
            <div className="border border-border border-blue-100 dark:border-blue-900/50 rounded">
              <div className="bg-blue-50 dark:bg-blue-950/50 px-3 py-2 rounded-t border-b border-border border-blue-100 dark:border-blue-900/50 flex items-center gap-2">
                <Globe className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-600">Get Results via API</span>
              </div>

              <div className="bg-card p-3 rounded-b border-t-0 space-y-2">
                  {/* Method, URL and Request button in one row */}
                  <div className="flex items-center gap-2">
                    {/* Method - fixed width */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs font-medium">Method:</span>
                      <code className="text-xs bg-card px-2 py-1 rounded border border-border">
                        {tool.httpRequest.method}
                      </code>
                    </div>

                    {/* URL - takes remaining space */}
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="text-xs font-medium flex-shrink-0">URL:</span>
                      <code className="text-xs bg-card px-2 py-1 rounded border border-border flex-1 truncate min-w-0">
                        {httpUrl}
                      </code>
                    </div>

                    {/* Request button - fixed width */}
                    {!isStreaming && execution?.status === 'pending' && !autoMode && (
                      <div className="flex-shrink-0">
                        {!isRequestingHttp ? (
                          <Button
                            size="xs"
                            onClick={handleHttpRequest}
                            className="flex items-center gap-1 px-2 py-3 text-xs"
                            disabled={isProvidingResult || isProvidingError}
                          >
                            <Send className="w-3 h-3" />
                            Request
                          </Button>
                        ) : (
                          <div className="flex items-center gap-1 text-xs text-blue-600">
                            <div className="w-3 h-3 border border-blue-600 border-t-transparent rounded-full animate-spin" />
                            Requesting...
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {httpHeaders.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-xs font-medium">Headers:</span>
                      {httpHeaders.map((header, index) => (
                        <div key={index} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                          <Input
                            value={header.key}
                            onChange={(e) => {
                              const newHeaders = [...httpHeaders]
                              newHeaders[index].key = e.target.value
                              setHttpHeaders(newHeaders)
                            }}
                            className="h-6 text-xs flex-1 min-w-0"
                            placeholder="Header Key"
                            disabled={isRequestingHttp}
                          />
                          <Input
                            value={header.value}
                            onChange={(e) => {
                              const newHeaders = [...httpHeaders]
                              newHeaders[index].value = e.target.value
                              setHttpHeaders(newHeaders)
                            }}
                            className="h-6 text-xs flex-1 min-w-0"
                            placeholder="Header Value"
                            disabled={isRequestingHttp}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {execution?.result && (
              <div className="min-w-0">
                <div className="bg-green-50 dark:bg-green-950/50 px-3 py-2 rounded-t border border-border border-green-100 dark:border-green-900/50 flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-600" />
                  <span className="text-sm font-medium text-green-600">Result</span>
                </div>
                <div className="bg-card border border-t-0 border-border border-green-100 dark:border-green-900/50 rounded-b">
                  <ResultDisplay content={execution.result} />
                </div>
              </div>
            )}

            {execution?.error && (
              <div className="min-w-0">
                <div className="bg-red-100 dark:bg-red-950/50 px-3 py-2 rounded-t border border-border border-red-200 dark:border-red-900/50 flex items-center gap-2">
                  <X className="w-4 h-4 text-red-600" />
                  <span className="text-sm font-medium text-red-600">Result</span>
                </div>
                <div className="bg-card border border-t-0 border-border border-red-200 dark:border-red-900/50 rounded-b">
                  <pre className="text-sm p-3 whitespace-pre-wrap break-all overflow-wrap-anywhere min-w-0 overflow-x-auto text-foreground">
                    {execution.error}
                  </pre>
                </div>
              </div>
            )}
          </div>

          {!isStreaming && execution?.status === 'pending' && !autoMode && !isProvidingResult && !isProvidingError && (
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  setIsProvidingResult(true)
                  onScrollToBottom?.()
                }}
                className="flex items-center gap-2"
              >
                <Play className="w-3 h-3" />
                Provide Result
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => {
                  setIsProvidingError(true)
                  onScrollToBottom?.()
                }}
                className="flex items-center gap-2"
              >
                <X className="w-3 h-3" />
                Mark as Failed
              </Button>
            </div>
          )}

          {isProvidingResult && (
            <div className="space-y-3 border-t border-border pt-3">
              <div className="space-y-2">
                <Label htmlFor="tool-result">Tool Result</Label>
                <Textarea
                  id="tool-result"
                  value={result}
                  onChange={(e) => setResult(e.target.value)}
                  placeholder="Enter the result returned by the tool..."
                  rows={4}
                />
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleProvideResult} disabled={!result.trim()}>
                  <Check className="w-3 h-3 mr-1" />
                  Submit Result
                </Button>
                <Button size="sm" variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {isProvidingError && (
            <div className="space-y-3 border-t border-border pt-3">
              <div className="space-y-2">
                <Label htmlFor="tool-error">Error Message</Label>
                <Textarea
                  id="tool-error"
                  value={error}
                  onChange={(e) => setError(e.target.value)}
                  placeholder="Describe what went wrong with the tool execution..."
                  rows={3}
                />
              </div>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="destructive" 
                  onClick={handleProvideError} 
                  disabled={!error.trim()}
                >
                  <X className="w-3 h-3 mr-1" />
                  Mark as Failed
                </Button>
                <Button size="sm" variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
      <ToastContainer />
    </div>
  )
}
