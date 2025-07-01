export interface Message {
  id: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: number;
  // For tool messages
  tool_call_id?: string;
  name?: string;
  // For error handling and retry
  error?: string;
  canRetry?: boolean;
}

export interface ChatSession {
  id: string;
  name: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  agentId?: string; // The agent used in this session
  toolIds?: string[]; // Tools selected for no-agent mode
  systemPrompt?: string; // Custom system prompt for this session
}

export interface APIConfig {
  provider: string;
  endpoint: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  systemPrompt: string;
}

export interface SavedAPIKeys {
  [providerName: string]: string;
}

export interface SavedAPIEndpoints {
  [providerName: string]: string;
}

export interface ModelProvider {
  name: string;
  endpoint: string;
  models: string[];
  defaultModel: string;
  requiresApiKey: boolean;
  docsLink: string;
  client: 'openai' | 'anthropic';
}

export interface AvailableModel {
  id: string; // unique identifier: `${provider}-${model}`
  provider: string;
  model: string;
  displayName: string; // for UI display
}

export interface CurrentModel {
  provider: string;
  model: string;
}

export interface ChatCompletionRequest {
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant' | 'tool';
    content: string;
    tool_calls?: ToolCall[];
    tool_call_id?: string;
  }>;
  temperature?: number;
  max_completion_tokens?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  stream?: boolean;
  stream_options?: { include_usage: boolean };
  tools?: ToolSchema[];
  tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
}

export interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
      tool_calls?: ToolCall[];
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Agent and Tool related types
export interface HTTPRequestConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url: string;
  headers: { key: string; value: string }[];
}

export interface Tool {
  id: string;
  name: string;
  description: string;
  schema: ToolSchema;
  httpRequest?: HTTPRequestConfig;
  tag?: string; // 工具分类标签
  createdAt: number;
  updatedAt: number;
}

export interface ToolSchema {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  tools: string[]; // Store tool IDs instead of full Tool objects
  order?: number; // For drag and drop ordering
  createdAt: number;
  updatedAt: number;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolCallExecution {
  id: string;
  toolCall: ToolCall;
  status: 'pending' | 'completed' | 'failed';
  result?: string;
  error?: string;
  timestamp: number;
}

export interface AgentMessage extends Message {
  toolCalls?: ToolCall[];
  toolCallExecutions?: ToolCallExecution[];
  incomplete?: boolean; // Mark message as incomplete/stopped
  reasoningContent?: string; // For providers that support reasoning (like DeepSeek)
  reasoningDuration?: number; // Duration of reasoning in milliseconds
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  provider?: string; // The provider used for this message (e.g., "OpenAI", "Deepseek")
  model?: string; // The model used for this message (e.g., "gpt-4o", "deepseek-chat")
}
