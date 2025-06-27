export interface Provider {
  name: string
  endpoint: string
  models: string[]
  defaultModel: string
  requiresApiKey: boolean
  docsLink: string
  client: 'openai' | 'anthropic'
}

export const MODEL_PROVIDERS: Provider[] = [
  {
    name: 'OpenAI',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano', 'o1', 'o1-mini', 'o3', 'o3-mini', 'o4-mini'],
    defaultModel: 'gpt-4o',
    requiresApiKey: true,
    docsLink: 'https://platform.openai.com/docs/api-reference/chat/create',
    client: 'openai'
  },
  {
    name: 'Deepseek',
    endpoint: 'https://api.deepseek.com/chat/completions',
    models: ['deepseek-chat', 'deepseek-reasoner'],
    defaultModel: 'deepseek-chat',
    requiresApiKey: true,
    docsLink: 'https://api-docs.deepseek.com/zh-cn/api/create-chat-completion',
    client: 'openai'
  },
  {
    name: 'Qwen',
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    models: ['qwen-plus', 'qwen-plus-latest', 'qwen-plus-2025-04-28', 'qwen-plus-2025-01-25', 'deepseek-r1', 'deepseek-v3', 'deepseek-r1-distill-llama-70b'],
    defaultModel: 'qwen-plus-latest',
    requiresApiKey: true,
    docsLink: 'https://help.aliyun.com/zh/model-studio/use-qwen-by-calling-api',
    client: 'openai'
  },
  {
    name: 'Doubao',
    endpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    models: ['doubao-seed-1.6-250615', 'doubao-seed-1.6-flash-250615', 'doubao-seed-1.6-thinking-250615', 'deepseek-v3-250324', 'deepseek-r1-250528'],
    defaultModel: 'doubao-seed-1.6-250615',
    requiresApiKey: true,
    docsLink: 'https://www.volcengine.com/docs/82379/1494384',
    client: 'openai'
  },
  {
    name: 'Qianfan',
    endpoint: 'https://qianfan.baidubce.com/v2/chat/completions',
    models: ['ernie-4.5-turbo-128k', 'ernie-4.5-turbo-32k', 'deepseek-v3'],
    defaultModel: 'ernie-4.5-turbo-128k',
    requiresApiKey: true,
    docsLink: 'https://cloud.baidu.com/doc/qianfan-api/s/3m7of64lb',
    client: 'openai'
  },
  {
    name: 'XunfeiXinhuo',
    endpoint: 'https://spark-api-open.xf-yun.com/v1/chat/completions',
    models: ['4.0Ultra', 'generalv3.5', 'max-32k', 'generalv3', 'pro-128k'],
    defaultModel: '4.0Ultra',
    requiresApiKey: true,
    docsLink: 'https://www.xfyun.cn/doc/spark/HTTP调用文档.html',
    client: 'openai'
  },
  {
    name: 'Ollama (Local)',
    endpoint: 'http://localhost:11434/v1/chat/completions',
    models: ['qwen3:8b', 'deepseek-r1:8b', 'llama2', 'llama2:13b', 'llama2:70b', 'codellama', 'mistral', 'mixtral', 'neural-chat', 'starling-lm'],
    defaultModel: 'qwen3:8b',
    requiresApiKey: false,
    docsLink: 'https://github.com/jmorganca/ollama',
    client: 'openai'
  },
  {
    name: 'Custom',
    endpoint: '',
    models: ['custom-model'],
    defaultModel: 'custom-model',
    requiresApiKey: true,
    docsLink: '',
    client: 'openai'
  }
]

export const DEFAULT_CONFIG = {
  systemPrompt: 'You are a helpful assistant.',
  temperature: 0.7,
  maxTokens: 2000,
  topP: 1,
  frequencyPenalty: 0,
  presencePenalty: 0,
  stream: true
}

export interface ProviderCustomConfig {
  providerId: string
  endpoint?: string
  models?: string[]
  currentModel?: string
}
