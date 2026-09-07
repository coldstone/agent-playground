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
  // Set when the user typed "/skill-name ...": the content carries the injected skill block,
  // the UI shows a chip instead of the raw block.
  skillInvocation?: SkillInvocationInfo;
}

export interface SkillInvocationInfo {
  name: string;
  rest: string;
}

export interface ChatSession {
  id: string;
  name: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  agentId?: string; // The agent used in this session
  toolIds?: string[]; // Tools selected for no-agent mode
  skillIds?: string[]; // Skills selected for no-agent mode (mirrors toolIds, unused for now)
  systemPrompt?: string; // Custom system prompt for this session
}

export interface APIConfig {
  provider: string;
  endpoint: string;
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens?: number;
  topP: number;
  frequencyPenalty: number;
  presencePenalty: number;
  systemPrompt: string;
  // Azure OpenAI specific fields
  azureApiVersion?: string;
  // GPT-5 specific fields
  reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
  verbosity?: 'low' | 'medium' | 'high';
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
  client: 'openai' | 'anthropic' | 'azure-openai';
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
  usage: TokenUsage;
}

// Normalized token usage shared by every provider.
// Optional fields are only present when the provider reports them.
export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cached_tokens?: number; // Prompt tokens served from the provider's prompt cache (cache read / hit)
  cache_write_tokens?: number; // Prompt tokens written to the cache (Anthropic-style cache creation)
  reasoning_tokens?: number; // Completion tokens spent on reasoning, when reported separately
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
  mcp?: MCPToolBinding; // Present when the tool is provided by an MCP server
  builtin?: BuiltinToolBinding; // Present when the tool is executed in the page (skills, web fetch)
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
  tools: string[]; // Store tool IDs instead of full Tool objects (legacy)
  toolBindings?: AgentToolBinding[]; // New authorization-aware tool bindings
  skills?: string[]; // Skill ids bound to this agent (unused for now)
  order?: number; // For drag and drop ordering
  visible?: boolean; // Controls visibility in chat overlay (defaults to true)
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
  /**
   * Id of the tool this call was bound to when the model made it, resolved against the tools
   * that were actually sent in that request. Execution and rendering must use this instead of
   * matching by function name: a local tool and an MCP tool can share a name, and the local one
   * must never run in place of the MCP one.
   */
  toolId?: string;
  status: 'pending' | 'completed' | 'failed';
  result?: string;
  error?: string;
  timestamp: number;
  progress?: MCPToolProgress; // Latest progress notification (MCP tools)
  mcpContent?: MCPContentBlock[]; // Raw MCP content blocks for rich display
  structuredContent?: unknown; // MCP structured tool output, when provided
}

export interface AgentMessage extends Message {
  toolCalls?: ToolCall[];
  toolCallExecutions?: ToolCallExecution[];
  incomplete?: boolean; // Mark message as incomplete/stopped
  reasoningContent?: string; // For providers that support reasoning (like DeepSeek)
  reasoningDuration?: number; // Duration of reasoning in milliseconds
  usage?: TokenUsage;
  provider?: string; // The provider used for this message (e.g., "OpenAI", "Deepseek")
  model?: string; // The model used for this message (e.g., "gpt-4o", "deepseek-chat")
}

// Authorization management
export interface Authorization {
  id: string;
  name: string;
  description?: string;
  headers: { key: string; value: string }[];
  tag?: string; // Tool tag association, undefined means global
  isDefaultInTag: boolean; // Default authorization for this tag
  createdAt: number;
  updatedAt: number;
}

export interface AgentToolBinding {
  toolId: string;
  authorizationId?: string; // If not set, use default authorization
}

// MCP (Model Context Protocol) related types
export interface MCPHeader {
  key: string;
  value: string;
}

export interface MCPToolAnnotations {
  title?: string;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

export interface MCPToolInfo {
  name: string;
  title?: string;
  description?: string;
  inputSchema: Record<string, any>;
  outputSchema?: Record<string, any>;
  annotations?: MCPToolAnnotations;
}

export interface MCPResourceInfo {
  uri: string;
  name: string;
  title?: string;
  description?: string;
  mimeType?: string;
  size?: number;
}

export interface MCPResourceTemplateInfo {
  uriTemplate: string;
  name: string;
  title?: string;
  description?: string;
  mimeType?: string;
}

export interface MCPPromptInfo {
  name: string;
  title?: string;
  description?: string;
  arguments?: Array<{ name: string; description?: string; required?: boolean }>;
}

export interface MCPServerInfo {
  name: string;
  version: string;
  title?: string;
}

export type MCPServerStatus = 'idle' | 'connecting' | 'connected' | 'error';
export type MCPProtocolEra = 'legacy' | 'modern';

export interface MCPServer {
  id: string;
  name: string;
  url: string; // Streamable HTTP endpoint, e.g. https://example.com/mcp
  headers: MCPHeader[]; // Static request headers (e.g. Authorization)
  enabled: boolean; // Whether the server's tools are offered to the model
  disabledTools: string[]; // Tool names the user switched off (new tools default to enabled)
  tools: MCPToolInfo[];
  resources: MCPResourceInfo[];
  resourceTemplates: MCPResourceTemplateInfo[];
  prompts: MCPPromptInfo[];
  serverInfo?: MCPServerInfo;
  protocolVersion?: string;
  protocolEra?: MCPProtocolEra;
  capabilities?: Record<string, unknown>;
  instructions?: string;
  status: MCPServerStatus;
  error?: string;
  lastConnectedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface MCPToolBinding {
  serverId: string;
  serverName: string;
  toolName: string; // Original tool name on the MCP server
  annotations?: MCPToolAnnotations;
  outputSchema?: Record<string, any>;
}

export interface MCPToolProgress {
  progress: number;
  total?: number;
  message?: string;
}

// Loose representation of an MCP content block (text | image | audio | resource_link | resource)
export interface MCPContentBlock {
  type: string;
  text?: string;
  data?: string;
  mimeType?: string;
  uri?: string;
  name?: string;
  title?: string;
  description?: string;
  resource?: { uri: string; mimeType?: string; text?: string; blob?: string };
  [key: string]: unknown;
}

export interface MCPCallToolResult {
  content: MCPContentBlock[];
  structuredContent?: unknown;
  isError?: boolean;
}

// Elicitation request relayed from an MCP server to the UI
export interface MCPElicitationRequest {
  id: string;
  serverUrl: string;
  mode: 'form' | 'url';
  message: string;
  requestedSchema?: Record<string, any>;
  url?: string;
}

export interface MCPElicitResult {
  action: 'accept' | 'decline' | 'cancel';
  content?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Agent Skills
// ---------------------------------------------------------------------------

/** Built-in tools that run inside the page: skill access and web fetch. */
export interface BuiltinToolBinding {
  kind: 'load_skill' | 'read_skill_file' | 'list_skill_files' | 'search_skill_files' | 'web_fetch' | 'web_search';
}

/** Index entry for one file bundled with a skill. Contents live in the skill-files store. */
export interface SkillFileInfo {
  path: string;
  size: number;
  mimeType: string;
  isText: boolean;
}

/** One file of a skill's virtual file system. */
export interface SkillFileRecord {
  id: string; // `${skillId}:${path}`
  skillId: string;
  path: string;
  size: number;
  mimeType: string;
  isText: boolean;
  text?: string; // Set for text files
  blob?: Blob; // Set for binary files (listed, not readable by the model)
}

export type SkillSource = 'folder' | 'zip' | 'manual' | 'url';

export interface Skill {
  id: string; // generated
  name: string; // frontmatter name (lenient: warn if it differs from the folder)
  description: string;
  license?: string;
  compatibility?: string;
  metadata?: Record<string, string>;
  allowedTools?: string; // stored, not enforced (informational)
  body: string; // SKILL.md markdown after the frontmatter
  frontmatterRaw: string;
  files: SkillFileInfo[]; // index only; contents live in `skill-files`
  enabled: boolean; // offered to the model
  source: SkillSource;
  warnings: string[]; // lenient-validation diagnostics shown in the UI
  createdAt: number;
  updatedAt: number;
}
