import { APIConfig } from '@/types'

export class TitleGenerator {
  private config: APIConfig

  constructor(config: APIConfig) {
    this.config = config
  }

  async generateTitle(aiResponse: string): Promise<string> {
    try {
      const prompt = `Generate a very short title (2-5 words) that summarizes the topic or main point:

"${aiResponse.slice(0, 500)}"`

      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            {
              role: 'system',
              content: 'You are a title generator that uses user conversation language. Generate very short, concise titles (2-5 words) capturing the main topic. Return only the title, no quotes or extra text.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 20,
          temperature: 0.3,
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      const title = data.choices?.[0]?.message?.content?.trim()
      
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
