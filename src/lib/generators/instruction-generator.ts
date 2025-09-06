import { APIConfig } from '@/types'
import { createClient } from '@/lib/client-factory'
import { devLog } from '@/lib/dev-utils'

export class InstructionGenerator {
  private config: APIConfig
  private provider: string

  constructor(config: APIConfig, provider: string) {
    this.config = config
    this.provider = provider
  }

  async *generateInstruction(prompt: string): AsyncGenerator<string, void, unknown> {
    if (!prompt.trim() || !this.config?.apiKey || !this.config?.endpoint) {
      throw new Error('Invalid prompt or API configuration')
    }

    const client = createClient(this.config, [], this.provider)

    const systemPrompt = `You are an expert in AI Agents, proficient in the principles of various AI Agents, and possess extensive practical experience. Please assist users in generating excellent prompts for AI Agent.

Guidelines for creating system prompts:
1. Be specific about the agent's role and capabilities
2. Include clear instructions on how the agent should behave
3. Specify the tone and communication style
4. Include any relevant constraints or guidelines
5. Description of available tools and their invocation order.
6. Make it actionable and practical
7. Keep it concise but comprehensive

IMPORTANT: You must generate the system prompt in the same language as the user's input. If the user writes in Chinese, generate the instruction in Chinese. If the user writes in English, generate the instruction in English. Always match the user's language exactly.

Generate a system prompt that would make an AI agent behave exactly as described by the user.`

    const userMessage = `Create a system prompt for an AI agent with the following requirements:

${prompt}

Please generate a clear, professional system prompt that defines how this agent should behave and respond to users.`

    const messages = [
      { id: 'system', role: 'system' as const, content: systemPrompt, timestamp: Date.now() },
      { id: 'user', role: 'user' as const, content: userMessage, timestamp: Date.now() }
    ]

    try {
      for await (const chunk of client.streamChatCompletion(messages)) {
        if (chunk.content) {
          yield chunk.content
        }
      }
    } catch (error) {
      devLog.error('Failed to generate instruction:', error)
      throw error
    }
  }

  async generateInstructionComplete(prompt: string): Promise<string> {
    let result = ''
    for await (const chunk of this.generateInstruction(prompt)) {
      result += chunk
    }
    return result
  }
}
