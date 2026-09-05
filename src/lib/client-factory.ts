import { APIConfig, Tool } from '@/types'
import { OpenAIClient, AzureOpenAIClient } from '@/lib/clients'
import { OpenRouterClient } from '@/lib/clients/openrouter-client'
import { MODEL_PROVIDERS } from '@/lib/providers'
import { devLog } from '@/lib/dev-utils'

/**
 * Belt and braces: the model must never see two tools with the same function name, otherwise a
 * tool call cannot be attributed to one of them. Callers are expected to keep names unique; this
 * drops any later duplicate that slips through.
 */
function dedupeToolNames(tools: Tool[]): Tool[] {
  const seen: Record<string, boolean> = {}
  const unique: Tool[] = []

  tools.forEach((tool) => {
    const name = tool.name
    if (seen[name]) {
      devLog.warn(`Dropping duplicate tool name "${name}" (tool id ${tool.id}) before sending to the model`)
      return
    }
    seen[name] = true
    unique.push(tool)
  })

  return unique
}

export function createClient(config: APIConfig, tools: Tool[] = [], providerName: string) {
  tools = dedupeToolNames(tools)

  // Find provider to determine client type
  const provider = MODEL_PROVIDERS.find(p => p.name === providerName)
  
  if (!provider) {
    throw new Error(`Unknown provider: ${providerName}`)
  }

  switch (provider.client) {
    case 'azure-openai':
      return new AzureOpenAIClient(config, tools)
    case 'openrouter':
      return new OpenRouterClient(config, tools, providerName)
    case 'openai':
    default:
      return new OpenAIClient(config, tools, providerName)
  }
}