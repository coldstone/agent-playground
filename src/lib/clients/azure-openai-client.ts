import { APIConfig, ChatCompletionRequest, Message, Tool, ToolCall, AgentMessage } from '@/types'
import { devLog } from '@/lib/dev-utils'

export class AzureOpenAIClient {
  private config: APIConfig
  private tools: Tool[]

  constructor(config: APIConfig, tools: Tool[] = []) {
    this.config = config
    this.tools = tools
  }

  private buildEndpoint(): string {
    // Azure OpenAI endpoint format: 
    // https://{resource-name}.openai.azure.com/openai/deployments/{deployment-name}/chat/completions?api-version={api-version}
    // deployment-name is the current model name
    const { endpoint, model } = this.config
    const apiVersion = (this.config.azureApiVersion && this.config.azureApiVersion.trim()) || '2025-04-01-preview'
    
    if (!endpoint || !model) {
      throw new Error('Azure OpenAI requires endpoint and model (deployment name)')
    }

    // Extract resource name from endpoint
    // Expected format: your-resource-name.openai.azure.com or https://your-resource-name.openai.azure.com
    let resourceEndpoint = endpoint
    
    // Remove protocol if present
    if (resourceEndpoint.startsWith('https://')) {
      resourceEndpoint = resourceEndpoint.substring(8)
    } else if (resourceEndpoint.startsWith('http://')) {
      resourceEndpoint = resourceEndpoint.substring(7)
    }
    
    // Remove / at the end of the endpoint
    resourceEndpoint = resourceEndpoint.replace(/\/$/, '')

    return `https://${resourceEndpoint}/openai/deployments/${model}/chat/completions?api-version=${apiVersion}`
  }

  async *streamChatCompletion(messages: (Message | AgentMessage)[], abortSignal?: AbortSignal): AsyncGenerator<{ content?: string; reasoningContent?: string; toolCalls?: ToolCall[]; usage?: any }, void, unknown> {
    // Check if model should exclude temperature and top_p (o series and gpt-5 series)
    const modelName = this.config.model.toLowerCase()
    const shouldExcludeAdvancedParams = modelName.startsWith('o') || modelName.startsWith('gpt-5')

    const requestBody: any = {
      // Azure OpenAI doesn't need model parameter, it's in the URL path
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
      stream: true,
      stream_options: { include_usage: true }
    }

    const hasMaxTokens = typeof this.config.maxTokens === 'number'
    if (hasMaxTokens) {
      requestBody.max_completion_tokens = Math.max(4, this.config.maxTokens as number)
    }

    // Only add temperature and top_p for models that support them
    if (!shouldExcludeAdvancedParams) {
      requestBody.temperature = this.config.temperature
      requestBody.top_p = this.config.topP
    }

    // Add GPT-5 specific parameters
    if (modelName.startsWith('gpt-5')) {
      if (this.config.reasoningEffort) {
        ;(requestBody as any).reasoning_effort = this.config.reasoningEffort
      }
      if (this.config.verbosity) {
        ;(requestBody as any).verbosity = this.config.verbosity
      }
    }

    // Add tools if available
    if (this.tools.length > 0) {
      requestBody.tools = this.tools.map(tool => tool.schema)
      requestBody.tool_choice = 'auto'
    }

    try {
      const endpoint = this.buildEndpoint()
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.config.apiKey, // Azure uses api-key header instead of Authorization
        },
        body: JSON.stringify(requestBody),
        signal: abortSignal,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(`Azure OpenAI API Error: ${response.status} - ${errorData.error?.message || response.statusText}`)
      }

      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error('No response body')
      }

      const decoder = new TextDecoder()
      let buffer = ''

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

                if (delta.reasoning_content) {
                  result.reasoningContent = delta.reasoning_content
                }

                if (delta.tool_calls) {
                  result.toolCalls = delta.tool_calls
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
      devLog.error('Azure OpenAI Stream error:', error)
      throw error
    }
  }

  async chatCompletion(messages: (Message | AgentMessage)[]): Promise<string> {
    // Check if model should exclude temperature and top_p (o series and gpt-5 series)
    const modelName = this.config.model.toLowerCase()
    const shouldExcludeAdvancedParams = modelName.startsWith('o') || modelName.startsWith('gpt-5')

    const requestBody: any = {
      // Azure OpenAI doesn't need model parameter, it's in the URL path
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
      stream: false
    }

    if (typeof this.config.maxTokens === 'number') {
      requestBody.max_completion_tokens = Math.max(4, this.config.maxTokens as number)
    }

    // Only add temperature and top_p for models that support them
    if (!shouldExcludeAdvancedParams) {
      requestBody.temperature = this.config.temperature
      requestBody.top_p = this.config.topP
    }

    // Add GPT-5 specific parameters
    if (modelName.startsWith('gpt-5')) {
      if (this.config.reasoningEffort) {
        ;(requestBody as any).reasoning_effort = this.config.reasoningEffort
      }
      if (this.config.verbosity) {
        ;(requestBody as any).verbosity = this.config.verbosity
      }
    }

    try {
      const endpoint = this.buildEndpoint()
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.config.apiKey, // Azure uses api-key header instead of Authorization
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(`Azure OpenAI API Error: ${response.status} - ${errorData.error?.message || response.statusText}`)
      }

      const data = await response.json()
      return data.choices?.[0]?.message?.content || 'No response content'
    } catch (error) {
      devLog.error('Azure OpenAI Chat completion error:', error)
      throw error
    }
  }
}
