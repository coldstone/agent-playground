import { APIConfig, ChatCompletionRequest, Message, Tool, ToolCall, AgentMessage } from '@/types'
import { devLog } from '@/lib/dev-utils'

export class OpenRouterClient {
  private config: APIConfig
  private tools: Tool[]
  private providerName: string

  constructor(config: APIConfig, tools: Tool[] = [], providerName: string = 'OpenRouter') {
    this.config = config
    this.tools = tools
    this.providerName = providerName
  }

  async *streamChatCompletion(messages: (Message | AgentMessage)[], abortSignal?: AbortSignal): AsyncGenerator<{ content?: string; reasoningContent?: string; toolCalls?: ToolCall[]; usage?: any }, void, unknown> {
    const requestBody: any = {
      model: this.config.model,
      messages: messages.map(msg => {
        const baseMessage: any = {
          role: msg.role,
          content: msg.content
        }

        // Add tool-specific fields for tool messages
        if (msg.role === 'tool') {
          baseMessage.tool_call_id = msg.tool_call_id
          baseMessage.name = msg.name
        }

        // Add tool_calls for assistant messages with tool calls
        const agentMsg = msg as AgentMessage
        if (msg.role === 'assistant' && agentMsg.toolCalls && agentMsg.toolCalls.length > 0) {
          baseMessage.tool_calls = agentMsg.toolCalls.map(tc => ({
            id: tc.id,
            type: tc.type,
            function: {
              name: tc.function.name,
              arguments: tc.function.arguments
            }
          }))
        }

        return baseMessage
      }),
      frequency_penalty: this.config.frequencyPenalty,
      presence_penalty: this.config.presencePenalty,
      temperature: this.config.temperature,
      top_p: this.config.topP,
      max_tokens: this.config.maxTokens,
      stream: true,
      stream_options: { include_usage: true }
    }

    // Add tools if available
    if (this.tools.length > 0) {
      requestBody.tools = this.tools.map(tool => tool.schema)
      requestBody.tool_choice = 'auto'
    }

    try {
      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: abortSignal,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(`API Error: ${response.status} - ${errorData.error?.message || response.statusText}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No response body')
      }

      const decoder = new TextDecoder()
      let buffer = ''
      // Track complete tool calls to avoid overwriting with incomplete ones
      let completeToolCalls: { [index: number]: ToolCall } = {}
      let hasCompleteToolCalls = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (trimmed === '' || trimmed === 'data: [DONE]') continue

          if (trimmed.startsWith('data: ')) {
            try {
              const jsonStr = trimmed.slice(6)
              const data = JSON.parse(jsonStr)

              const delta = data.choices?.[0]?.delta
              const usage = data.usage

              if (delta) {
                const result: { content?: string; reasoningContent?: string; toolCalls?: ToolCall[]; usage?: any } = {}

                if (delta.content) {
                  result.content = delta.content
                }

                // Handle reasoning content (support both fields)
                if (delta.reasoning_content && delta.reasoning_content.trim() !== '') {
                  result.reasoningContent = delta.reasoning_content
                }
                if (delta.reasoning && delta.reasoning.trim() !== '') {
                  result.reasoningContent = delta.reasoning
                }

                // Special handling for OpenRouter tool calls
                if (delta.tool_calls && Array.isArray(delta.tool_calls)) {

                  // Check if any tool call in this delta has complete info (id + name)
                  const hasNewCompleteToolCall = delta.tool_calls.some((tc: any) =>
                    tc.id && tc.id.length > 0 && tc.function?.name && tc.function.name.length > 0
                  )

                  // Check if any tool call is just arguments continuation (including empty arguments)
                  const hasArgumentsContinuation = delta.tool_calls.some((tc: any) =>
                    !tc.id && tc.function && tc.function.hasOwnProperty('arguments')
                  )

                  if (hasNewCompleteToolCall) {
                    hasCompleteToolCalls = true
                    result.toolCalls = delta.tool_calls
                  } else if (hasArgumentsContinuation) {
                    // Convert to OpenAI-style format: only pass arguments delta, keep existing id/name
                    // For no-param tools, we still need to pass the empty arguments to complete the tool call
                    result.toolCalls = delta.tool_calls.map((tc: any, index: number) => ({
                      index: tc.index !== undefined ? tc.index : index,
                      function: {
                        arguments: tc.function?.arguments || ''
                      }
                    }))
                  } else {
                  }
                } else if (!delta.tool_calls && hasCompleteToolCalls) {
                }

                // Include usage if present
                if (usage) {
                  result.usage = usage
                }

                if (result.content || result.reasoningContent || result.toolCalls || result.usage) {
                  yield result
                }
              }

              // Handle usage information (final chunk before [DONE])
              if (usage && !delta) {
                yield { usage }
              }
            } catch (e) {
              devLog.warn('Failed to parse SSE data:', trimmed)
            }
          }
        }
      }
    } catch (error) {
      devLog.error('Stream error:', error)
      throw error
    }
  }

  async chatCompletion(messages: (Message | AgentMessage)[]): Promise<string> {
    const requestBody: any = {
      model: this.config.model,
      messages: messages.map(msg => {
        const baseMessage: any = {
          role: msg.role,
          content: msg.content
        }

        // Add tool-specific fields for tool messages
        if (msg.role === 'tool') {
          baseMessage.tool_call_id = msg.tool_call_id
          baseMessage.name = msg.name
        }

        // Add tool_calls for assistant messages with tool calls
        const agentMsg = msg as AgentMessage
        if (msg.role === 'assistant' && agentMsg.toolCalls && agentMsg.toolCalls.length > 0) {
          baseMessage.tool_calls = agentMsg.toolCalls.map(tc => ({
            id: tc.id,
            type: tc.type,
            function: {
              name: tc.function.name,
              arguments: tc.function.arguments
            }
          }))
        }

        return baseMessage
      }),
      frequency_penalty: this.config.frequencyPenalty,
      presence_penalty: this.config.presencePenalty,
      temperature: this.config.temperature,
      top_p: this.config.topP,
      max_tokens: this.config.maxTokens,
      stream: false
    }

    try {
      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(`API Error: ${response.status} - ${errorData.error?.message || response.statusText}`)
      }

      const data = await response.json()
      return data.choices?.[0]?.message?.content || 'No response content'
    } catch (error) {
      devLog.error('Chat completion error:', error)
      throw error
    }
  }
}