import { APIConfig, Tool } from '@/types'
import { OpenAIClient, AzureOpenAIClient } from '@/lib/clients'
import { MODEL_PROVIDERS } from '@/lib/providers'

export function createClient(config: APIConfig, tools: Tool[] = [], providerName: string) {
  // Find provider to determine client type
  const provider = MODEL_PROVIDERS.find(p => p.name === providerName)
  
  if (!provider) {
    throw new Error(`Unknown provider: ${providerName}`)
  }

  switch (provider.client) {
    case 'azure-openai':
      return new AzureOpenAIClient(config, tools)
    case 'openai':
    default:
      return new OpenAIClient(config, tools, providerName)
  }
}