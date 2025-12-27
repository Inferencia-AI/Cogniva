import { Hono } from 'hono'
import { sql } from '../utils/neon.js'
import { invokeLLM, generateResponse, classifyQuery } from '../utils/ollamaEnhanced.js'
import { searchUserNotes, formatNoteSearchResponse } from '../utils/noteSearch.js'
import { processMessage, createRAGFlow, createAgentFlow } from '../agent/bot_response_flow.js'
import type { SchemaType, ConversationMessage } from '../types/agent.js'

// =============================================================================
// Chat Routes
// =============================================================================

const chatRoutes = new Hono()

// =============================================================================
// GET /chat/history/:uid - Get all chats for a user
// =============================================================================
chatRoutes.get('/history/:uid', async (c) => {
  const result = await sql`SELECT * FROM chats WHERE user_id = ${c.req.param('uid')}`
  return c.json(result)
})

// =============================================================================
// DELETE /chat/:id - Delete a chat
// =============================================================================
chatRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id')
  await sql`DELETE FROM chats WHERE id = ${id}`
  return c.json({ success: true })
})

// =============================================================================
// POST /chat/save - Save a chat
// =============================================================================
chatRoutes.post('/save', async (c) => {
  let { userId, messages, chatId = null } = await c.req.json()
  let result
  if (chatId) {
    result = await sql`UPDATE chats SET messages = ${messages} WHERE id = ${chatId} RETURNING *`
  } else {
    result = await sql`INSERT INTO chats (user_id, messages) VALUES (${userId}, ${messages}) RETURNING *`
  }
  return c.json(result)
})

// =============================================================================
// POST /chat - Send a message and get AI response (Legacy + Enhanced)
// =============================================================================
chatRoutes.post('/', async (c) => {
  try {
    const { messages, schema, useAgent = false, userId, forceSchema } = await c.req.json()

    // If useAgent flag is set, use the new ReAct agent system
    if (useAgent) {
      const lastMessage = messages[messages.length - 1]
      const userMessage = typeof lastMessage.content === 'string' 
        ? lastMessage.content 
        : JSON.stringify(lastMessage.content)

      const conversationHistory: ConversationMessage[] = messages.map((m: { role: string; content: string | object }) => ({
        role: m.role as 'human' | 'ai' | 'system' | 'tool',
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
        timestamp: Date.now(),
      }))

      const result = await processMessage(userMessage, {
        userId,
        conversationHistory,
        forceSchema: forceSchema as SchemaType,
      })

      if (result.error) {
        return c.json({
          success: false,
          error: result.error,
          response: null,
        }, 500)
      }

      // Return in a format compatible with frontend expectations
      return c.json([{
        ...result.response,
        metadata: result.metadata,
        steps: result.steps,
      }])
    }

    // Legacy behavior - direct LLM invocation with schema
    const response = await invokeLLM(messages, schema)

    // Normalize response to an array and remove duplicate entries
    const responsesArray = Array.isArray(response) ? response : [response]

    // Normalize different response shapes to a string key for deduplication
    const normalizeForKey = (item: unknown): string => {
      if (item === null || item === undefined) return ''
      if (typeof item === 'string') return item
      if (typeof item === 'number' || typeof item === 'boolean') return String(item)
      if (Array.isArray(item)) {
        return item.map((v) => normalizeForKey(v)).join('|')
      }
      if (typeof item === 'object') {
        const obj = item as Record<string, unknown>

        // Common patterns used in responses
        if (typeof obj.response === 'string') return obj.response
        if (Array.isArray(obj.response)) {
          return obj.response.map((r) => {
            if (typeof r === 'string') return r
            if (r && typeof r === 'object') return (r as any).text || JSON.stringify(r)
            return String(r)
          }).join('|')
        }
        if (typeof obj.text === 'string') return obj.text
        // Fallback to stable JSON string
        try {
          return JSON.stringify(obj)
        } catch {
          return String(obj)
        }
      }
      return String(item)
    }

    const seen = new Set<string>()
    const deduped = responsesArray.filter((item) => {
      const key = normalizeForKey(item)
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })

    return c.json(deduped)

  } catch (error) {
    console.error('Chat error:', error)
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500)
  }
})

// =============================================================================
// POST /chat/smart - Smart chat with automatic schema selection
// =============================================================================
chatRoutes.post('/smart', async (c) => {
  try {
    const { messages, userId } = await c.req.json()

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return c.json({ error: 'messages array is required' }, 400)
    }

    const lastMessage = messages[messages.length - 1]
    const userMessage = typeof lastMessage.content === 'string' 
      ? lastMessage.content 
      : ''

    // Classify the query to determine best response type
    const classification = await classifyQuery(userMessage)

    // Use RAG flow for knowledge-based queries, agent flow for complex queries
    const flow = classification.complexity === 'simple' 
      ? createRAGFlow() 
      : createAgentFlow()

    const conversationHistory: ConversationMessage[] = messages.map((m: { role: string; content: string | object }) => ({
      role: m.role as 'human' | 'ai' | 'system' | 'tool',
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
      timestamp: Date.now(),
    }))

    const result = await flow.process(userMessage, conversationHistory, {
      userId,
      forceSchema: classification.responseType,
    })

    return c.json({
      success: !result.error,
      response: result.response,
      classification,
      metadata: result.metadata,
      steps: result.steps,
      error: result.error,
    })

  } catch (error) {
    console.error('Smart chat error:', error)
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500)
  }
})

// =============================================================================
// POST /chat/rag - RAG-enhanced chat (searches notes/corpus first)
// =============================================================================
chatRoutes.post('/rag', async (c) => {
  try {
    const { messages, userId, schemaType = 'conversational' } = await c.req.json()

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return c.json({ error: 'messages array is required' }, 400)
    }

    const lastMessage = messages[messages.length - 1]
    const userMessage = typeof lastMessage.content === 'string' 
      ? lastMessage.content 
      : ''

    const flow = createRAGFlow()

    const conversationHistory: ConversationMessage[] = messages.map((m: { role: string; content: string | object }) => ({
      role: m.role as 'human' | 'ai' | 'system' | 'tool',
      content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
      timestamp: Date.now(),
    }))

    const result = await flow.process(userMessage, conversationHistory, {
      userId,
      forceSchema: schemaType as SchemaType,
    })

    return c.json({
      success: !result.error,
      response: result.response,
      sources: result.response?.sources || [],
      metadata: result.metadata,
      error: result.error,
    })

  } catch (error) {
    console.error('RAG chat error:', error)
    return c.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, 500)
  }
})

// =============================================================================
// POST /chat/search-notes - Semantic search through user's notes
// =============================================================================
chatRoutes.post('/search-notes', async (c) => {
  const { userId, query } = await c.req.json()

  if (!userId || !query) {
    return c.json({ error: 'userId and query are required' }, 400)
  }

  try {
    const noteResults = await searchUserNotes(userId, query, {
      topK: 3,
      threshold: 0.59,
    })

    const formattedNotes = formatNoteSearchResponse(noteResults)

    if (!formattedNotes?.length) {
      return c.json({ notes: [] })
    }

    return c.json({
      type: 'notes',
      topic: 'From Your Notes',
      notes: formattedNotes,
      sources: formattedNotes.map((note) => ({
        title: note.title,
        url: `note://${note.noteId}`,
        snippet: note.body?.slice(0, 150) || '',
        noteId: note.noteId,
      })),
    })
  } catch (error) {
    console.error('Error searching notes:', error)
    return c.json({ notes: [] })
  }
})

// =============================================================================
// POST /chat/classify - Classify a message to determine response type
// =============================================================================
chatRoutes.post('/classify', async (c) => {
  try {
    const { message } = await c.req.json()

    if (!message) {
      return c.json({ error: 'message is required' }, 400)
    }

    const classification = await classifyQuery(message)

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

export default chatRoutes
