/**
 * Binding tool calls to the tool that will actually run.
 *
 * A tool call carries only a function name. Names are not unique across sources: a local HTTP
 * tool, an MCP tool and a built-in skill tool can all be called `get_record_list`. Resolving a
 * call by name against every tool the app knows would let a local tool - with its own endpoint
 * and credentials - execute a call the model made against an MCP tool. So every call is bound to
 * a concrete tool id at creation time, against the exact list that was sent in that request, and
 * execution and rendering follow the binding.
 *
 * See docs/TOOL-RESOLUTION.md.
 */
import { Tool, ToolCall, ToolCallExecution } from '@/types'

/** Id of the offered tool a call refers to, or undefined when the model named something else. */
export function bindToolCallToOfferedTool(toolCall: ToolCall, offeredTools: Tool[]): string | undefined {
  const match = offeredTools.filter((tool) => tool.name === toolCall.function.name)[0]
  return match ? match.id : undefined
}

/**
 * The tool an execution should run against.
 *
 * `allTools` is only searched by id, never by name. The name fallback exists for executions saved
 * before binding existed and is restricted to `offeredTools` - the tools currently on offer in
 * this conversation. When neither resolves, the caller must not execute anything.
 */
export function resolveBoundTool(
  execution: ToolCallExecution | undefined,
  toolCall: ToolCall | undefined,
  allTools: Tool[],
  offeredTools: Tool[]
): Tool | undefined {
  if (execution && execution.toolId) {
    return allTools.filter((tool) => tool.id === execution.toolId)[0]
  }

  const name = (toolCall && toolCall.function.name) || (execution && execution.toolCall.function.name)
  if (!name) return undefined

  return offeredTools.filter((tool) => tool.name === name)[0]
}

/**
 * Drop local tools whose name is taken by a built-in tool. The built-in names are fixed, so the
 * local tool is simply not offered rather than being shadowed on the way to the model.
 */
export function excludeShadowedTools(
  localTools: Tool[],
  builtinTools: Tool[],
  onShadowed?: (tool: Tool) => void
): Tool[] {
  if (builtinTools.length === 0) return localTools

  const reserved: Record<string, boolean> = {}
  builtinTools.forEach((tool) => {
    reserved[tool.name] = true
  })

  return localTools.filter((tool) => {
    if (!reserved[tool.name]) return true
    if (onShadowed) onShadowed(tool)
    return false
  })
}
