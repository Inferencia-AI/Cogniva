import { Hono } from 'hono'
import { sql } from '../utils/neon.js'
import { invokeLLM } from '../utils/ollama.js'
import { searchUserNotes, formatNoteSearchResponse } from '../utils/noteSearch.js'

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
// POST /chat - Send a message and get AI response
// =============================================================================
chatRoutes.post('/', async (c) => {
  const { messages, schema } = await c.req.json()
  const response = await invokeLLM(messages, schema)
  return c.json(response)
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

export default chatRoutes
