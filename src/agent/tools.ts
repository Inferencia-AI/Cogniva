// =============================================================================
// Agent Tools - Tool definitions and implementations for ReAct agent
// =============================================================================

import type { Tool, ToolResult, ToolParameter } from '../types/agent.js'
import { searchUserNotes, formatNoteSearchResponse } from '../utils/noteSearch.js'
import { search as tavilySearch } from '../functions/search.js'
import { sql } from '../utils/neon.js'
import { semanticSearch } from 'query-sense'

// =============================================================================
// Tool Registry
// =============================================================================

const toolRegistry: Map<string, Tool> = new Map()

/**
 * Register a tool
 */
export function registerTool(tool: Tool): void {
  toolRegistry.set(tool.name, tool)
}

/**
 * Get a tool by name
 */
export function getTool(name: string): Tool | undefined {
  return toolRegistry.get(name)
}

/**
 * Get all available tools
 */
export function getAllTools(): Tool[] {
  return Array.from(toolRegistry.values())
}

/**
 * Get tool descriptions for LLM prompt
 */
export function getToolDescriptions(): string {
  const tools = getAllTools()
  return tools
    .map((tool) => {
      const params = Object.entries(tool.parameters)
        .map(([name, param]) => `  - ${name} (${param.type}): ${param.description}`)
        .join('\n')
      const required = tool.required.length > 0 ? `Required: ${tool.required.join(', ')}` : ''
      return `**${tool.name}**: ${tool.description}\nParameters:\n${params}\n${required}`
    })
    .join('\n\n')
}

/**
 * Get tool schema for LLM
 */
export function getToolSchema(): object[] {
  const tools = getAllTools()
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: {
      type: 'object',
      properties: tool.parameters,
      required: tool.required,
    },
  }))
}

// =============================================================================
// Tool Execution
// =============================================================================

/**
 * Execute a tool by name
 */
export async function executeTool(
  toolName: string,
  params: Record<string, unknown>
): Promise<ToolResult> {
  const tool = getTool(toolName)
  
  if (!tool) {
    return {
      success: false,
      data: null,
      error: `Tool "${toolName}" not found`,
    }
  }

  // Validate required parameters
  for (const required of tool.required) {
    if (params[required] === undefined || params[required] === null) {
      return {
        success: false,
        data: null,
        error: `Missing required parameter: ${required}`,
      }
    }
  }

  try {
    const result = await tool.execute(params)
    return result
  } catch (error) {
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error during tool execution',
    }
  }
}

// =============================================================================
// Built-in Tools
// =============================================================================

/**
 * Search Notes Tool - Search user's personal notes
 */
const searchNotesTool: Tool = {
  name: 'searchNotes',
  description: 'Search through user\'s personal notes for relevant information. Use when the user asks about their own notes or needs information from their saved content.',
  parameters: {
    userId: {
      type: 'string',
      description: 'The user ID to search notes for',
    },
    query: {
      type: 'string',
      description: 'The search query to find relevant notes',
    },
    topK: {
      type: 'number',
      description: 'Number of results to return (default: 3)',
      default: 3,
    },
    threshold: {
      type: 'number',
      description: 'Similarity threshold 0-1 (default: 0.5)',
      default: 0.5,
    },
  },
  required: ['userId', 'query'],
  execute: async (params): Promise<ToolResult> => {
    const { userId, query, topK = 3, threshold = 0.5 } = params as {
      userId: string
      query: string
      topK?: number
      threshold?: number
    }

    try {
      const results = await searchUserNotes(userId, query, { topK, threshold })
      const formatted = formatNoteSearchResponse(results)

      return {
        success: true,
        data: {
          notes: formatted || [],
          count: formatted?.length || 0,
          query,
        },
        metadata: {
          source: 'notes',
          threshold,
        },
      }
    } catch (error) {
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Failed to search notes',
      }
    }
  },
}

/**
 * Search Corpus Tool - Search knowledge base articles
 */
const searchCorpusTool: Tool = {
  name: 'searchCorpus',
  description: 'Search through subscribed knowledge bases for relevant articles. Use when the user needs information from their knowledge bases or subscribed content.',
  parameters: {
    userId: {
      type: 'string',
      description: 'The user ID to get subscribed knowledgebases',
    },
    query: {
      type: 'string',
      description: 'The search query to find relevant corpus articles',
    },
    topK: {
      type: 'number',
      description: 'Number of results to return (default: 3)',
      default: 3,
    },
  },
  required: ['userId', 'query'],
  execute: async (params): Promise<ToolResult> => {
    const { userId, query, topK = 3 } = params as {
      userId: string
      query: string
      topK?: number
    }

    try {
      // Get user's subscribed knowledgebases
      const subscriptions = await sql`
        SELECT k.id, k.name 
        FROM knowledgebases k
        WHERE k.creator_id = ${userId} 
           OR ${userId} = ANY(k.subscribers)
      ` as Array<{ id: number; name: string }>

      if (!subscriptions.length) {
        return {
          success: true,
          data: { corpus: [], count: 0, query },
          metadata: { source: 'corpus' },
        }
      }

      const kbIds = subscriptions.map((s) => s.id)

      // Get all corpus from subscribed knowledgebases
      const corpusItems = await sql`
        SELECT c.*, k.name as knowledgebase_name
        FROM corpus c
        JOIN knowledgebases k ON c.knowledgebase_id = k.id
        WHERE c.knowledgebase_id = ANY(${kbIds}::int[])
          AND c.is_approved = true
      ` as Array<{ id: number; title: string; body: string; keywords: string[]; knowledgebase_id: number; knowledgebase_name: string }>

      if (!corpusItems.length) {
        return {
          success: true,
          data: { corpus: [], count: 0, query },
          metadata: { source: 'corpus' },
        }
      }

      // Prepare content for semantic search
      const corpusContents = corpusItems.map(
        (item) =>
          `${item.title}\n${item.body || ''}\n${item.keywords?.join(', ') || ''}`
      )

      // Perform semantic search
      const searchResults = await semanticSearch(query, corpusContents, {
        topK,
        threshold: 0.5,
      })

      // Map results back to corpus items
      const matchedCorpus = searchResults.results.map((result: { document: string; score: number }) => {
        const index = corpusContents.findIndex((c) => c === result.document)
        const item = corpusItems[index]
        if (!item) return null
        return {
          corpusId: item.id,
          title: item.title,
          body: item.body,
          keywords: item.keywords,
          knowledgebaseId: item.knowledgebase_id,
          knowledgebaseName: item.knowledgebase_name,
          similarity: result.score,
        }
      }).filter(Boolean)

      return {
        success: true,
        data: {
          corpus: matchedCorpus,
          count: matchedCorpus.length,
          query,
        },
        metadata: { source: 'corpus' },
      }
    } catch (error) {
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Failed to search corpus',
      }
    }
  },
}

/**
 * Web Search Tool - Search the web using Tavily
 */
const webSearchTool: Tool = {
  name: 'webSearch',
  description: 'Search the web for current information. Use when the user needs up-to-date information or facts not available in notes/corpus.',
  parameters: {
    query: {
      type: 'string',
      description: 'The search query',
    },
    includeImages: {
      type: 'boolean',
      description: 'Whether to include images in results (default: true)',
      default: true,
    },
  },
  required: ['query'],
  execute: async (params): Promise<ToolResult> => {
    const { query, includeImages = true } = params as {
      query: string
      includeImages?: boolean
    }

    try {
      const results = await tavilySearch(query)

      return {
        success: true,
        data: {
          answer: results.answer,
          links: results.links,
          images: includeImages ? results.images : [],
          query,
        },
        metadata: { source: 'web', provider: 'tavily' },
      }
    } catch (error) {
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Failed to perform web search',
      }
    }
  },
}

/**
 * Calculate Tool - Perform mathematical calculations
 */
const calculateTool: Tool = {
  name: 'calculate',
  description: 'Perform mathematical calculations. Use for any math operations the user requests.',
  parameters: {
    expression: {
      type: 'string',
      description: 'Mathematical expression to evaluate (e.g., "2 + 2", "sqrt(16)", "sin(45)")',
    },
  },
  required: ['expression'],
  execute: async (params): Promise<ToolResult> => {
    const { expression } = params as { expression: string }

    try {
      // Safe math evaluation using Function constructor with restricted scope
      const mathFunctions = {
        abs: Math.abs,
        ceil: Math.ceil,
        floor: Math.floor,
        round: Math.round,
        sqrt: Math.sqrt,
        pow: Math.pow,
        sin: Math.sin,
        cos: Math.cos,
        tan: Math.tan,
        log: Math.log,
        log10: Math.log10,
        exp: Math.exp,
        PI: Math.PI,
        E: Math.E,
        min: Math.min,
        max: Math.max,
      }

      // Sanitize expression - only allow numbers, operators, and function names
      const sanitized = expression.replace(/[^0-9+\-*/().%\s,a-zA-Z]/g, '')
      
      // Create a safe evaluation context
      const fn = new Function(
        ...Object.keys(mathFunctions),
        `return (${sanitized})`
      )
      
      const result = fn(...Object.values(mathFunctions))

      if (typeof result !== 'number' || !isFinite(result)) {
        throw new Error('Invalid calculation result')
      }

      return {
        success: true,
        data: {
          expression: sanitized,
          result,
        },
      }
    } catch (error) {
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Failed to calculate expression',
      }
    }
  },
}

/**
 * Get Current Time Tool
 */
const getCurrentTimeTool: Tool = {
  name: 'getCurrentTime',
  description: 'Get the current date and time. Use when the user asks about the current time or date.',
  parameters: {
    timezone: {
      type: 'string',
      description: 'Timezone (e.g., "America/New_York", "UTC"). Default is UTC.',
      default: 'UTC',
    },
    format: {
      type: 'string',
      description: 'Output format: "full", "date", "time"',
      enum: ['full', 'date', 'time'],
      default: 'full',
    },
  },
  required: [],
  execute: async (params): Promise<ToolResult> => {
    const { timezone = 'UTC', format = 'full' } = params as {
      timezone?: string
      format?: 'full' | 'date' | 'time'
    }

    try {
      const now = new Date()
      const options: Intl.DateTimeFormatOptions = { timeZone: timezone }

      let result: string
      switch (format) {
        case 'date':
          options.dateStyle = 'full'
          result = now.toLocaleDateString('en-US', options)
          break
        case 'time':
          options.timeStyle = 'long'
          result = now.toLocaleTimeString('en-US', options)
          break
        default:
          options.dateStyle = 'full'
          options.timeStyle = 'long'
          result = now.toLocaleString('en-US', options)
      }

      return {
        success: true,
        data: {
          formatted: result,
          iso: now.toISOString(),
          timezone,
          timestamp: now.getTime(),
        },
      }
    } catch (error) {
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Failed to get current time',
      }
    }
  },
}

/**
 * Summarize Content Tool
 */
const summarizeContentTool: Tool = {
  name: 'summarizeContent',
  description: 'Summarize long content into a concise format. Use when you have retrieved long content that needs to be condensed.',
  parameters: {
    content: {
      type: 'string',
      description: 'The content to summarize',
    },
    maxLength: {
      type: 'number',
      description: 'Maximum length of summary in words (default: 100)',
      default: 100,
    },
    style: {
      type: 'string',
      description: 'Summary style: "bullet", "paragraph", "tldr"',
      enum: ['bullet', 'paragraph', 'tldr'],
      default: 'paragraph',
    },
  },
  required: ['content'],
  execute: async (params): Promise<ToolResult> => {
    const { content, maxLength = 100, style = 'paragraph' } = params as {
      content: string
      maxLength?: number
      style?: 'bullet' | 'paragraph' | 'tldr'
    }

    // This tool returns parameters for the LLM to use
    // The actual summarization happens in the agent's response generation
    return {
      success: true,
      data: {
        originalLength: content.split(/\s+/).length,
        targetLength: maxLength,
        style,
        contentPreview: content.slice(0, 500) + (content.length > 500 ? '...' : ''),
        instruction: `Summarize the following content in ${style} format, keeping it under ${maxLength} words`,
      },
      metadata: {
        requiresLLM: true,
        fullContent: content,
      },
    }
  },
}

/**
 * No Operation Tool - Fallback when no tool is needed
 */
const noOpTool: Tool = {
  name: 'noOp',
  description: 'Do nothing and proceed to generate a response. Use when you have enough information to answer without any tools.',
  parameters: {
    reason: {
      type: 'string',
      description: 'Reason why no tool is needed',
    },
  },
  required: [],
  execute: async (params): Promise<ToolResult> => {
    const { reason = 'No tool needed' } = params as { reason?: string }
    return {
      success: true,
      data: { reason },
      metadata: { isNoop: true },
    }
  },
}

// =============================================================================
// Register all built-in tools
// =============================================================================

registerTool(searchNotesTool)
registerTool(searchCorpusTool)
registerTool(webSearchTool)
registerTool(calculateTool)
registerTool(getCurrentTimeTool)
registerTool(summarizeContentTool)
registerTool(noOpTool)

// =============================================================================
// Export tool utilities
// =============================================================================

export {
  searchNotesTool,
  searchCorpusTool,
  webSearchTool,
  calculateTool,
  getCurrentTimeTool,
  summarizeContentTool,
  noOpTool,
}
