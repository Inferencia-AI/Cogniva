// =============================================================================
// Agent Routes - ReAct Agent API endpoints
// =============================================================================

import { Hono } from 'hono'
import { 
  BotResponseFlow, 
  createSimpleChatFlow, 
  createRAGFlow, 
  createAgentFlow,
  createCodeAssistantFlow,
  createResearchFlow,
  processMessage 
} from '../agent/bot_response_flow.js'
import { getAllTools, getToolDescriptions } from '../agent/tools.js'
import { getAllSchemas, getSchema } from '../schemas/responseSchemas.js'
import type { AgentConfig, SchemaType, ConversationMessage } from '../types/agent.js'
import { invokeLLM, generateResponse, classifyQuery } from '../utils/ollamaEnhanced.js'

// =============================================================================
// Agent Routes
// =============================================================================

const agentRoutes = new Hono()

// (No global prompt moderation middleware applied)

// =============================================================================
// POST /agent/chat - Main agent endpoint with ReAct pattern
// =============================================================================
agentRoutes.post('/chat', async (c) => {
  try {
    const body = await c.req.json()
    const { 
      messages, 
      userId, 
      sessionId, 
      config,
      forceSchema,
      flowType = 'agent' // 'simple', 'rag', 'agent', 'code', 'research'
    } = body

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return c.json({ error: 'messages array is required' }, 400)
    }

    // Get the last user message
    const lastMessage = messages[messages.length - 1]
    const userMessage = typeof lastMessage.content === 'string' 
      ? lastMessage.content 
      : lastMessage.content?.toString() || ''

    // Convert to conversation history
    const conversationHistory: ConversationMessage[] = messages.map((m: { role: string; content: string }) => ({
      role: m.role as 'human' | 'ai' | 'system' | 'tool',
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
      timestamp: Date.now(),
    }))

    // Select the appropriate flow based on flowType
    let flow: BotResponseFlow
    switch (flowType) {
      case 'simple':
        flow = createSimpleChatFlow()
        break
      case 'rag':
        flow = createRAGFlow()
        break
      case 'code':
        flow = createCodeAssistantFlow()
        break
      case 'research':
        flow = createResearchFlow()
        break
      default:
        flow = createAgentFlow()
    }

    // If custom config is provided, create new flow with it
    if (config) {
      flow = new BotResponseFlow(config)
    }

    // Process the message
    const result = await flow.process(userMessage, conversationHistory, {
      userId,
      sessionId,
      forceSchema: forceSchema as SchemaType,
    })

    if (result.error) {
      return c.json({
        success: false,
        error: result.error,
        steps: result.steps,
        metadata: result.metadata,
      }, 500)
    }

    return c.json({
      success: true,
      response: result.response,
      steps: result.steps,
      metadata: result.metadata,
    })

  } catch (error) {
    console.error('Agent chat error:', error)
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500)
  }
})

// =============================================================================
// POST /agent/quick - Quick response without full ReAct loop
// =============================================================================
agentRoutes.post('/quick', async (c) => {
  try {
    const { messages, schema, schemaType } = await c.req.json()

    if (!messages || !Array.isArray(messages)) {
      return c.json({ error: 'messages array is required' }, 400)
    }

    let response: unknown

    if (schemaType) {
      // Use predefined schema
      response = await generateResponse(messages, schemaType as SchemaType)
    } else if (schema) {
      // Use custom schema
      response = await invokeLLM(messages, schema)
    } else {
      // Use default conversational schema
      response = await generateResponse(messages, 'conversational')
    }

    return c.json({
      success: true,
      response: Array.isArray(response) ? response : [response],
    })

  } catch (error) {
    console.error('Quick response error:', error)
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500)
  }
})

// =============================================================================
// POST /agent/classify - Classify a query's intent and best response type
// =============================================================================
agentRoutes.post('/classify', async (c) => {
  try {
    const { query } = await c.req.json()

    if (!query) {
      return c.json({ error: 'query is required' }, 400)
    }

    const classification = await classifyQuery(query)

    return c.json({
      success: true,
      classification,
    })

  } catch (error) {
    console.error('Classification error:', error)
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500)
  }
})

// =============================================================================
// POST /agent/code - Code-specific responses
// =============================================================================
agentRoutes.post('/code', async (c) => {
  try {
    const { messages, userId, language, context } = await c.req.json()

    if (!messages || !Array.isArray(messages)) {
      return c.json({ error: 'messages array is required' }, 400)
    }

    // Get the last user message
    const lastMessage = messages[messages.length - 1]
    const userMessage = typeof lastMessage.content === 'string' 
      ? lastMessage.content 
      : ''

    // Create code assistant flow
    const flow = createCodeAssistantFlow()

    // Add language context if provided
    const enhancedMessages: ConversationMessage[] = messages.map((m: { role: string; content: string }) => ({
      role: m.role as 'human' | 'ai' | 'system' | 'tool',
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
      timestamp: Date.now(),
    }))

    if (language || context) {
      enhancedMessages.unshift({
        role: 'system',
        content: `Programming context: ${language ? `Language: ${language}` : ''} ${context || ''}`.trim(),
        timestamp: Date.now(),
      })
    }

    const result = await flow.process(userMessage, enhancedMessages, {
      userId,
      forceSchema: 'code',
    })

    return c.json({
      success: !result.error,
      response: result.response,
      steps: result.steps,
      metadata: result.metadata,
      error: result.error,
    })

  } catch (error) {
    console.error('Code response error:', error)
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500)
  }
})

// =============================================================================
// POST /agent/search - Search and research responses
// =============================================================================
agentRoutes.post('/search', async (c) => {
  try {
    const { query, userId, sources = ['notes', 'corpus', 'web'] } = await c.req.json()

    if (!query) {
      return c.json({ error: 'query is required' }, 400)
    }

    // Determine which tools to enable based on sources
    const enabledTools: string[] = []
    if (sources.includes('notes')) enabledTools.push('searchNotes')
    if (sources.includes('corpus')) enabledTools.push('searchCorpus')
    if (sources.includes('web')) enabledTools.push('webSearch')

    const flow = new BotResponseFlow({
      maxIterations: 3,
      enabledTools,
      defaultSchema: 'search',
    })

    const result = await flow.process(query, [], {
      userId,
      forceSchema: 'search',
    })

    return c.json({
      success: !result.error,
      response: result.response,
      steps: result.steps,
      metadata: result.metadata,
      error: result.error,
    })

  } catch (error) {
    console.error('Search error:', error)
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500)
  }
})

// =============================================================================
// POST /agent/analyze - Analytical responses
// =============================================================================
agentRoutes.post('/analyze', async (c) => {
  try {
    const { content, question, userId } = await c.req.json()

    if (!content && !question) {
      return c.json({ error: 'content or question is required' }, 400)
    }

    const prompt = question 
      ? `Analyze this question: ${question}\n\nContext:\n${content || ''}` 
      : `Analyze the following content:\n\n${content}`

    const messages: ConversationMessage[] = [{
      role: 'human',
      content: prompt,
      timestamp: Date.now(),
    }]

    const flow = new BotResponseFlow({
      maxIterations: 3,
      enabledTools: ['searchCorpus', 'searchNotes'],
      defaultSchema: 'analytical',
    })

    const result = await flow.process(prompt, messages, {
      userId,
      forceSchema: 'analytical',
    })

    return c.json({
      success: !result.error,
      response: result.response,
      steps: result.steps,
      metadata: result.metadata,
      error: result.error,
    })

  } catch (error) {
    console.error('Analysis error:', error)
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500)
  }
})

// =============================================================================
// POST /agent/compare - Comparison responses
// =============================================================================
agentRoutes.post('/compare', async (c) => {
  try {
    const { items, criteria, userId } = await c.req.json()

    if (!items || !Array.isArray(items) || items.length < 2) {
      return c.json({ error: 'At least 2 items are required for comparison' }, 400)
    }

    const prompt = `Compare the following items${criteria ? ` based on: ${criteria}` : ''}:\n\n${items.map((item: string, i: number) => `${i + 1}. ${item}`).join('\n')}`

    const response = await generateResponse(
      [{ role: 'human', content: prompt }],
      'comparison'
    )

    return c.json({
      success: true,
      response,
    })

  } catch (error) {
    console.error('Comparison error:', error)
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500)
  }
})

// =============================================================================
// POST /agent/task - Break down tasks into steps
// =============================================================================
agentRoutes.post('/task', async (c) => {
  try {
    const { task, context } = await c.req.json()

    if (!task) {
      return c.json({ error: 'task is required' }, 400)
    }

    const prompt = `Break down this task into actionable steps${context ? `\n\nContext: ${context}` : ''}:\n\n${task}`

    const response = await generateResponse(
      [{ role: 'human', content: prompt }],
      'task'
    )

    return c.json({
      success: true,
      response,
    })

  } catch (error) {
    console.error('Task breakdown error:', error)
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500)
  }
})

// =============================================================================
// POST /agent/summarize - Summarize content
// =============================================================================
agentRoutes.post('/summarize', async (c) => {
  try {
    const { content, length = 'moderate', format = 'paragraph' } = await c.req.json()

    if (!content) {
      return c.json({ error: 'content is required' }, 400)
    }

    const lengthGuide = {
      brief: 'in 2-3 sentences',
      moderate: 'in a short paragraph (4-6 sentences)',
      detailed: 'comprehensively with key details',
    }

    const prompt = `Summarize the following content ${lengthGuide[length as keyof typeof lengthGuide] || lengthGuide.moderate}:\n\n${content}`

    const response = await generateResponse(
      [{ role: 'human', content: prompt }],
      'summary'
    )

    return c.json({
      success: true,
      response,
    })

  } catch (error) {
    console.error('Summarization error:', error)
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500)
  }
})

// =============================================================================
// POST /agent/instruct - Generate instructions/how-to guides
// =============================================================================
agentRoutes.post('/instruct', async (c) => {
  try {
    const { topic, audience = 'general', detail = 'moderate' } = await c.req.json()

    if (!topic) {
      return c.json({ error: 'topic is required' }, 400)
    }

    const prompt = `Create a step-by-step guide for: ${topic}\n\nTarget audience: ${audience}\nDetail level: ${detail}`

    const response = await generateResponse(
      [{ role: 'human', content: prompt }],
      'instruction'
    )

    return c.json({
      success: true,
      response,
    })

  } catch (error) {
    console.error('Instruction error:', error)
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500)
  }
})

// =============================================================================
// GET /agent/tools - List available tools
// =============================================================================
agentRoutes.get('/tools', async (c) => {
  const tools = getAllTools().map(tool => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    required: tool.required,
  }))

  return c.json({
    success: true,
    tools,
    count: tools.length,
  })
})

// =============================================================================
// GET /agent/schemas - List available response schemas
// =============================================================================
agentRoutes.get('/schemas', async (c) => {
  const schemas = getAllSchemas().map(schema => ({
    type: schema.type,
    name: schema.name,
    description: schema.description,
  }))

  return c.json({
    success: true,
    schemas,
    count: schemas.length,
  })
})

// =============================================================================
// GET /agent/schema/:type - Get specific schema details
// =============================================================================
agentRoutes.get('/schema/:type', async (c) => {
  const schemaType = c.req.param('type') as SchemaType
  
  try {
    const schema = getSchema(schemaType)
    
    return c.json({
      success: true,
      schema,
    })
  } catch (error) {
    return c.json({
      success: false,
      error: `Schema type "${schemaType}" not found`,
    }, 404)
  }
})

// =============================================================================
// POST /agent/flow/custom - Run a custom flow configuration
// =============================================================================
agentRoutes.post('/flow/custom', async (c) => {
  try {
    const { 
      message, 
      userId,
      config,
    } = await c.req.json()

    if (!message) {
      return c.json({ error: 'message is required' }, 400)
    }

    if (!config) {
      return c.json({ error: 'config is required for custom flow' }, 400)
    }

    const flow = new BotResponseFlow(config as Partial<AgentConfig>)
    const result = await flow.process(message, [], { userId })

    return c.json({
      success: !result.error,
      response: result.response,
      steps: result.steps,
      metadata: result.metadata,
      error: result.error,
    })

  } catch (error) {
    console.error('Custom flow error:', error)
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500)
  }
})

// =============================================================================
// Health check
// =============================================================================
agentRoutes.get('/health', async (c) => {
  return c.json({
    status: 'ok',
    version: '1.0.0',
    features: {
      tools: getAllTools().length,
      schemas: getAllSchemas().length,
      flows: ['simple', 'rag', 'agent', 'code', 'research'],
    },
  })
})

export default agentRoutes
