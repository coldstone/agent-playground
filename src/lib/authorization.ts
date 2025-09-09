import { Authorization, Tool, Agent, AgentToolBinding } from '@/types'

/**
 * Get effective authorization for a tool in the context of an agent
 */
export function getEffectiveAuthorization(
  tool: Tool,
  authorizations: Authorization[],
  agentBinding?: AgentToolBinding
): Authorization | null {
  // 1. Agent explicitly selected authorization
  if (agentBinding?.authorizationId) {
    return authorizations.find(auth => auth.id === agentBinding.authorizationId) || null
  }

  // 2. Tool tag's default authorization
  if (tool.tag) {
    const tagDefault = authorizations.find(auth => 
      auth.tag === tool.tag && auth.isDefaultInTag
    )
    if (tagDefault) return tagDefault
  }

  // 3. Global default authorization (no tag)
  const globalDefault = authorizations.find(auth => 
    !auth.tag && auth.isDefaultInTag
  )
  if (globalDefault) return globalDefault

  return null
}

/**
 * Get merged headers for a tool with authorization
 */
export function getMergedHeaders(
  tool: Tool,
  authorization: Authorization | null
): { key: string; value: string }[] {
  const toolHeaders = tool.httpRequest?.headers || []
  const authHeaders = authorization?.headers || []
  
  // Merge headers, authorization headers override tool headers
  const headerMap = new Map<string, string>()
  
  // Add tool headers first
  toolHeaders.forEach(header => {
    headerMap.set(header.key, header.value)
  })
  
  // Add/override with authorization headers
  authHeaders.forEach(header => {
    headerMap.set(header.key, header.value)
  })
  
  // Convert back to array format
  return Array.from(headerMap.entries()).map(([key, value]) => ({
    key,
    value
  }))
}

/**
 * Set authorization as default for its tag, ensuring uniqueness
 */
export async function setTagDefaultAuthorization(
  authorizationId: string,
  authorizations: Authorization[],
  updateCallback: (auth: Authorization) => Promise<void>
): Promise<void> {
  const targetAuth = authorizations.find(auth => auth.id === authorizationId)
  if (!targetAuth) {
    throw new Error('Authorization not found')
  }

  // Clear other defaults in the same tag
  const authsInTag = authorizations.filter(auth => 
    auth.tag === targetAuth.tag && auth.id !== authorizationId && auth.isDefaultInTag
  )
  
  for (const auth of authsInTag) {
    await updateCallback({ ...auth, isDefaultInTag: false })
  }

  // Set target as default
  await updateCallback({ ...targetAuth, isDefaultInTag: true })
}

/**
 * Get available authorizations for a tool
 */
export function getAvailableAuthorizations(
  tool: Tool,
  authorizations: Authorization[]
): Authorization[] {
  return authorizations.filter(auth => 
    // Global authorizations (no tag) are available to all tools
    !auth.tag || 
    // Or authorization tag matches tool tag
    auth.tag === tool.tag
  )
}

/**
 * Get all unique tags from tools
 */
export function getToolTags(tools: Tool[]): string[] {
  const tags = new Set<string>()
  tools.forEach(tool => {
    if (tool.tag) {
      tags.add(tool.tag)
    }
  })
  return Array.from(tags).sort()
}

/**
 * Convert legacy tools array to toolBindings for backward compatibility
 */
export function migrateAgentTools(agent: Agent): AgentToolBinding[] {
  if (agent.toolBindings) {
    return agent.toolBindings
  }
  
  // Legacy migration: convert tools array to toolBindings
  return (agent.tools || []).map(toolId => ({
    toolId,
    authorizationId: undefined // No authorization selected by default
  }))
}

/**
 * Get tool IDs from agent (supporting both legacy and new format)
 */
export function getAgentToolIds(agent: Agent): string[] {
  if (agent.toolBindings) {
    return agent.toolBindings.map(binding => binding.toolId)
  }
  return agent.tools || []
}