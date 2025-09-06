import { APIConfig, ToolSchema } from '@/types'
import { createClient } from '@/lib/client-factory'
import { devLog } from '@/lib/dev-utils'

export interface GeneratedTool {
  name: string
  description: string
  schema: ToolSchema
}

export class ToolGenerator {
  private config: APIConfig
  private provider: string

  constructor(config: APIConfig, provider: string) {
    this.config = config
    this.provider = provider
  }

  async generateTool(prompt: string): Promise<GeneratedTool> {
    if (!prompt.trim() || !this.config?.apiKey || !this.config?.endpoint) {
      throw new Error('Invalid prompt or API configuration')
    }

    const client = createClient(this.config, [], this.provider)

    const systemPrompt = `You are an expert at creating OpenAI function calling tools. Your task is to generate a tool definition based on the user's description.

You must respond with a valid JSON object containing exactly these fields:
- name: A snake_case function name (e.g., "get_weather", "search_web")
- description: A clear, concise description of what the tool does
- schema: A complete OpenAI function calling schema

The schema must follow this exact format:
{
  "type": "function",
  "function": {
    "name": "function_name",
    "description": "Function description",
    "parameters": {
      "type": "object",
      "properties": {
        "parameter_name": {
          "type": "string|number|boolean|array|object",
          "description": "Parameter description",
          "enum": ["option1", "option2"] // only if applicable
        }
      },
      "required": ["required_parameter_names"]
    }
  }
}

Important guidelines:
1. Use descriptive parameter names and descriptions
2. Include appropriate data types (string, number, boolean, array, object)
3. Add enum constraints where applicable
4. Mark required parameters in the "required" array
5. The function name in the schema must match the top-level name field
6. Keep all descriptions clear and concise, written in English
7. Consider edge cases and validation

Respond ONLY with the JSON object, no additional text or formatting.`

    const messages = [
      { id: 'system', role: 'system' as const, content: systemPrompt, timestamp: Date.now() },
      { id: 'user', role: 'user' as const, content: prompt, timestamp: Date.now() }
    ]

    try {
      const response = await client.chatCompletion(messages)

      if (!response) {
        throw new Error('No content received from API')
      }

      // Parse the JSON response
      let generatedTool: GeneratedTool
      try {
        generatedTool = JSON.parse(response.trim())
      } catch (parseError) {
        // Try to extract JSON from the response if it's wrapped in markdown or other text
        const jsonMatch = response.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          generatedTool = JSON.parse(jsonMatch[0])
        } else {
          throw new Error('Failed to parse generated tool JSON')
        }
      }

      // Validate the generated tool
      this.validateGeneratedTool(generatedTool)

      // Ensure the schema function name matches the tool name
      generatedTool.schema.function.name = generatedTool.name

      return generatedTool
    } catch (error) {
      devLog.error('Tool generation error:', error)
      throw error
    }
  }

  private validateGeneratedTool(tool: any): void {
    if (!tool || typeof tool !== 'object') {
      throw new Error('Generated tool must be an object')
    }

    if (!tool.name || typeof tool.name !== 'string') {
      throw new Error('Generated tool must have a valid name')
    }

    if (!tool.description || typeof tool.description !== 'string') {
      throw new Error('Generated tool must have a valid description')
    }

    if (!tool.schema || typeof tool.schema !== 'object') {
      throw new Error('Generated tool must have a valid schema')
    }

    const schema = tool.schema
    if (schema.type !== 'function') {
      throw new Error('Schema type must be "function"')
    }

    if (!schema.function || typeof schema.function !== 'object') {
      throw new Error('Schema must have a function object')
    }

    const func = schema.function
    if (!func.name || !func.description || !func.parameters) {
      throw new Error('Function schema must have name, description, and parameters')
    }

    if (func.parameters.type !== 'object') {
      throw new Error('Function parameters type must be "object"')
    }
  }
}
