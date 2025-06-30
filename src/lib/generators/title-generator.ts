import { APIConfig } from '@/types'
import { OpenAIClient } from '@/lib/clients'

export class TitleGenerator {
  private config: APIConfig
  private provider: string

  constructor(config: APIConfig, provider: string) {
    this.config = config
    this.provider = provider
  }

  async generateTitle(aiResponse: string): Promise<string> {
    try {
      if (!aiResponse.trim() || !this.config?.apiKey || !this.config?.endpoint) {
        throw new Error('Invalid input or API configuration')
      }

      const client = new OpenAIClient(this.config, [], this.provider)

      const systemPrompt = 'You are a title generator that uses user conversation language. Generate very short, concise titles (2-5 words) capturing the main topic. Return only the title, no quotes or extra text.'

      const userPrompt = `Generate a very short title (no more than 8 words) that summarizes the topic or main point:

"${aiResponse.slice(0, 500)}"`

      const messages = [
        { id: 'system', role: 'system' as const, content: systemPrompt, timestamp: Date.now() },
        { id: 'user', role: 'user' as const, content: userPrompt, timestamp: Date.now() }
      ]

      const response = await client.chatCompletion(messages)
      const title = response?.trim()

      if (title && title.length > 0) {
        // Clean up the title - remove quotes and limit length
        return title.replace(/['"]/g, '').slice(0, 50)
      }

      return 'New conversation' // Fallback
    } catch (error) {
      console.error('Failed to generate title:', error)
      // Generate a simple title from the user input as fallback
      return this.generateSimpleTitle(aiResponse)
    }
  }

  private generateSimpleTitle(text: string): string {
    try {
      // Clean and truncate the text
      const cleanText = text.trim().replace(/[^\w\s]/g, '').slice(0, 100)

      // Extract key words (longer than 2 characters)
      const words = cleanText.split(/\s+/).filter(word => word.length > 2)

      // Take first 2-4 meaningful words
      const titleWords = words.slice(0, 4)

      if (titleWords.length === 0) {
        return 'New conversation'
      }

      // Capitalize first letter of each word
      const title = titleWords
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ')

      return title.slice(0, 50) // Limit length
    } catch (error) {
      console.error('Failed to generate simple title:', error)
      return 'New conversation'
    }
  }
}
