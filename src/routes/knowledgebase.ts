import { Hono } from 'hono'
import { sql } from '../utils/neon.js'
import { searchUserNotes, formatNoteSearchResponse } from '../utils/noteSearch.js'

// =============================================================================
// Knowledgebase Types
// =============================================================================

interface Manager {
  userId: string
  role: 'admin' | 'editor' | 'viewer' | 'approver'
}

interface Knowledgebase {
  id: number
  banner_url: string | null
  image_url: string | null
  name: string | null
  description: string | null
  notes_ids: string[]
  managers: Manager[]
  subscribers_ids: string[]
  created_at: string
  updated_at: string
}

// =============================================================================
// Knowledgebase Routes
// =============================================================================

const knowledgebaseRoutes = new Hono()

// =============================================================================
// GET /knowledgebase/:id - Retrieve knowledgebase by ID
// =============================================================================
knowledgebaseRoutes.get('/:id', async (c) => {
  const id = c.req.param('id')
  
  try {
    const result = await sql`SELECT * FROM knowledgebase WHERE id = ${id}`
    
    if (!result.length) {
      return c.json({ error: 'Knowledgebase not found' }, 404)
    }
    
    return c.json(result[0])
  } catch (error) {
    console.error('Error fetching knowledgebase:', error)
    return c.json({ error: 'Failed to fetch knowledgebase' }, 500)
  }
})

// =============================================================================
// POST /knowledgebase - Create new knowledgebase
// =============================================================================
knowledgebaseRoutes.post('/', async (c) => {
  try {
    const { banner_url, image_url, name, description, userId } = await c.req.json()
    
    if (!name) {
      return c.json({ error: 'name is required' }, 400)
    }
    
    // Create initial manager with admin role for the creator
    // For jsonb[] we need to insert each jsonb element as an array element
    const initialManager = userId ? { userId, role: 'admin' } : null
    
    const result = initialManager 
      ? await sql`
          INSERT INTO knowledgebase (banner_url, image_url, name, description, notes_ids, managers, subscribers_ids)
          VALUES (
            ${banner_url || null}, 
            ${image_url || null}, 
            ${name}, 
            ${description || null},
            ARRAY[]::text[],
            ARRAY[${JSON.stringify(initialManager)}::jsonb],
            ARRAY[]::text[]
          )
          RETURNING *
        `
      : await sql`
          INSERT INTO knowledgebase (banner_url, image_url, name, description, notes_ids, managers, subscribers_ids)
          VALUES (
            ${banner_url || null}, 
            ${image_url || null}, 
            ${name}, 
            ${description || null},
            ARRAY[]::text[],
            ARRAY[]::jsonb[],
            ARRAY[]::text[]
          )
          RETURNING *
        `
    
    return c.json(result[0], 201)
  } catch (error) {
    console.error('Error creating knowledgebase:', error)
    return c.json({ error: 'Failed to create knowledgebase' }, 500)
  }
})

// =============================================================================
// PUT /knowledgebase/:id - Update knowledgebase
// =============================================================================
knowledgebaseRoutes.put('/:id', async (c) => {
  const id = c.req.param('id')
  
  try {
    const { banner_url, image_url, name, description, managers, notes_ids } = await c.req.json()
    
    // Check if knowledgebase exists
    const existing = await sql`SELECT * FROM knowledgebase WHERE id = ${id}`
    if (!existing.length) {
      return c.json({ error: 'Knowledgebase not found' }, 404)
    }
    
    // Handle managers update separately with raw SQL if needed
    if (managers !== undefined && Array.isArray(managers) && managers.length > 0) {
      // Build the managers array literal for PostgreSQL
      // Format: ARRAY['{"userId":"x","role":"admin"}'::jsonb, ...]
      const managersLiteral = managers
        .map((m: { userId: string; role: string }) => `'${JSON.stringify(m)}'::jsonb`)
        .join(', ')
      
      await sql`
        UPDATE knowledgebase 
        SET managers = ARRAY[${sql.unsafe(managersLiteral)}]
        WHERE id = ${id}
      `
    } else if (managers !== undefined && Array.isArray(managers) && managers.length === 0) {
      await sql`
        UPDATE knowledgebase 
        SET managers = ARRAY[]::jsonb[]
        WHERE id = ${id}
      `
    }
    
    // Update other fields
    const result = await sql`
      UPDATE knowledgebase 
      SET 
        banner_url = COALESCE(${banner_url ?? null}, banner_url),
        image_url = COALESCE(${image_url ?? null}, image_url),
        name = COALESCE(${name ?? null}, name),
        description = COALESCE(${description ?? null}, description),
        notes_ids = COALESCE(${notes_ids ?? null}, notes_ids),
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `
    
    return c.json(result[0])
  } catch (error) {
    console.error('Error updating knowledgebase:', error)
    return c.json({ error: 'Failed to update knowledgebase' }, 500)
  }
})

// =============================================================================
// DELETE /knowledgebase/:id - Delete knowledgebase
// =============================================================================
knowledgebaseRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id')
  
  try {
    const existing = await sql`SELECT * FROM knowledgebase WHERE id = ${id}`
    if (!existing.length) {
      return c.json({ error: 'Knowledgebase not found' }, 404)
    }
    
    await sql`DELETE FROM knowledgebase WHERE id = ${id}`
    
    return c.body(null, 204)
  } catch (error) {
    console.error('Error deleting knowledgebase:', error)
    return c.json({ error: 'Failed to delete knowledgebase' }, 500)
  }
})

// =============================================================================
// POST /knowledgebase/:id/subscribe - Subscribe user to knowledgebase
// =============================================================================
knowledgebaseRoutes.post('/:id/subscribe', async (c) => {
  const id = c.req.param('id')
  
  try {
    const { user_id } = await c.req.json()
    
    if (!user_id) {
      return c.json({ error: 'user_id is required' }, 400)
    }
    
    const existing = await sql`SELECT * FROM knowledgebase WHERE id = ${id}`
    if (!existing.length) {
      return c.json({ error: 'Knowledgebase not found' }, 404)
    }
    
    // Add user to subscribers if not already subscribed
    const result = await sql`
      UPDATE knowledgebase 
      SET subscribers_ids = array_append(
        array_remove(subscribers_ids, ${user_id}), 
        ${user_id}
      ),
      updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `
    
    return c.json({ success: true, knowledgebase: result[0] })
  } catch (error) {
    console.error('Error subscribing to knowledgebase:', error)
    return c.json({ error: 'Failed to subscribe' }, 500)
  }
})

// =============================================================================
// POST /knowledgebase/:id/unsubscribe - Unsubscribe user from knowledgebase
// =============================================================================
knowledgebaseRoutes.post('/:id/unsubscribe', async (c) => {
  const id = c.req.param('id')
  
  try {
    const { user_id } = await c.req.json()
    
    if (!user_id) {
      return c.json({ error: 'user_id is required' }, 400)
    }
    
    const existing = await sql`SELECT * FROM knowledgebase WHERE id = ${id}`
    if (!existing.length) {
      return c.json({ error: 'Knowledgebase not found' }, 404)
    }
    
    const result = await sql`
      UPDATE knowledgebase 
      SET subscribers_ids = array_remove(subscribers_ids, ${user_id}),
      updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `
    
    return c.json({ success: true, knowledgebase: result[0] })
  } catch (error) {
    console.error('Error unsubscribing from knowledgebase:', error)
    return c.json({ error: 'Failed to unsubscribe' }, 500)
  }
})

// =============================================================================
// GET /knowledgebase/:id/subscribers - Get subscribers list
// =============================================================================
knowledgebaseRoutes.get('/:id/subscribers', async (c) => {
  const id = c.req.param('id')
  
  try {
    const result = await sql`SELECT subscribers_ids FROM knowledgebase WHERE id = ${id}`
    
    if (!result.length) {
      return c.json({ error: 'Knowledgebase not found' }, 404)
    }
    
    return c.json({ subscribers: result[0].subscribers_ids || [] })
  } catch (error) {
    console.error('Error fetching subscribers:', error)
    return c.json({ error: 'Failed to fetch subscribers' }, 500)
  }
})

// =============================================================================
// POST /knowledgebase/search - Search knowledgebases by name or description
// =============================================================================
knowledgebaseRoutes.post('/search', async (c) => {
  try {
    const { query, filter = 'all' } = await c.req.json()
    
    if (!query) {
      return c.json({ error: 'query is required' }, 400)
    }
    
    const searchPattern = `%${query}%`
    
    if (filter === 'knowledgebases' || filter === 'all') {
      const knowledgebases = await sql`
        SELECT * FROM knowledgebase 
        WHERE name ILIKE ${searchPattern} OR description ILIKE ${searchPattern}
        ORDER BY updated_at DESC
        LIMIT 20
      `
      
      if (filter === 'knowledgebases') {
        return c.json({ knowledgebases, notes: [] })
      }
      
      // Also search notes that belong to knowledgebases
      const notes = await sql`
        SELECT n.* FROM notes n
        WHERE n.knowledgebase_id IS NOT NULL
        AND (n.title ILIKE ${searchPattern} OR n.body ILIKE ${searchPattern})
        ORDER BY n.id DESC
        LIMIT 20
      `
      
      return c.json({ knowledgebases, notes })
    }
    
    if (filter === 'notes') {
      const notes = await sql`
        SELECT n.* FROM notes n
        WHERE n.knowledgebase_id IS NOT NULL
        AND (n.title ILIKE ${searchPattern} OR n.body ILIKE ${searchPattern})
        ORDER BY n.id DESC
        LIMIT 20
      `
      
      return c.json({ knowledgebases: [], notes })
    }
    
    return c.json({ knowledgebases: [], notes: [] })
  } catch (error) {
    console.error('Error searching:', error)
    return c.json({ error: 'Failed to search' }, 500)
  }
})

// =============================================================================
// GET /knowledgebase/home/:uid - Get home page data for user
// =============================================================================
knowledgebaseRoutes.get('/home/:uid', async (c) => {
  const uid = c.req.param('uid')
  
  try {
    // Get featured knowledgebases (most subscribers or recent)
    const featured = await sql`
      SELECT * FROM knowledgebase 
      ORDER BY array_length(subscribers_ids, 1) DESC NULLS LAST, created_at DESC
      LIMIT 6
    `
    
    // Get user's subscribed knowledgebases and their latest notes
    const subscribed = await sql`
      SELECT k.*, 
        (SELECT json_agg(n.* ORDER BY n.id DESC) 
         FROM (SELECT * FROM notes WHERE knowledgebase_id = k.id ORDER BY id DESC LIMIT 3) n
        ) as latest_notes
      FROM knowledgebase k
      WHERE ${uid} = ANY(k.subscribers_ids)
      ORDER BY k.updated_at DESC
    `
    
    // Get knowledgebases where user is a manager/admin
    const myKnowledgebases = await sql`
      SELECT * FROM knowledgebase
      WHERE EXISTS (
        SELECT 1 FROM jsonb_array_elements(
          CASE WHEN managers IS NOT NULL AND array_length(managers, 1) > 0 
          THEN to_jsonb(managers) 
          ELSE '[]'::jsonb END
        ) as m
        WHERE m->>'userId' = ${uid}
      )
      ORDER BY updated_at DESC
    `
    
    return c.json({
      featured,
      subscribed,
      myKnowledgebases,
    })
  } catch (error) {
    console.error('Error fetching home data:', error)
    return c.json({ error: 'Failed to fetch home data' }, 500)
  }
})

// =============================================================================
// POST /knowledgebase/query - Query knowledgebase notes for answers
// =============================================================================
knowledgebaseRoutes.post('/query', async (c) => {
  try {
    const { question, knowledgebase_id } = await c.req.json()
    
    if (!question) {
      return c.json({ error: 'question is required' }, 400)
    }
    
    // Get notes from the specified knowledgebase or all knowledgebases
    let notes
    if (knowledgebase_id) {
      notes = await sql`
        SELECT * FROM notes 
        WHERE knowledgebase_id = ${knowledgebase_id}
      `
    } else {
      notes = await sql`
        SELECT * FROM notes 
        WHERE knowledgebase_id IS NOT NULL
      `
    }
    
    if (!notes.length) {
      return c.json({ notes: [], message: 'No notes found in knowledgebase' })
    }
    
    // Prepare note contents for semantic search
    const noteContents = (notes as Array<{ id: number; title: string; body: string }>).map((note) => 
      `${note.title}\n${note.body || ''}`
    )
    
    // Perform semantic search using the existing utility
    const { semanticSearch } = await import('query-sense')
    const searchResponse = await semanticSearch(question, noteContents, {
      topK: 5,
      threshold: 0.5,
    })
    
    // Map results back to notes
    const typedNotes = notes as Array<{ id: number; title: string; body: string }>
    const matchedNotes = searchResponse.results.map((result: { document: string; score: number }) => {
      const noteIndex = noteContents.findIndex((content: string) => content === result.document)
      if (noteIndex === -1) return null
      return {
        ...typedNotes[noteIndex],
        similarity: result.score,
      }
    }).filter((note): note is { id: number; title: string; body: string; similarity: number } => note !== null)
    
    return c.json({
      notes: matchedNotes,
      sources: matchedNotes.map((note) => ({
        title: note.title,
        url: `note://${note.id}`,
        snippet: note.body?.slice(0, 150) || '',
        noteId: note.id,
      })),
    })
  } catch (error) {
    console.error('Error querying knowledgebase:', error)
    return c.json({ error: 'Failed to query knowledgebase' }, 500)
  }
})

// =============================================================================
// POST /knowledgebase/:id/notes - Add note to knowledgebase
// =============================================================================
knowledgebaseRoutes.post('/:id/notes', async (c) => {
  const id = c.req.param('id')
  
  try {
    const { note_id } = await c.req.json()
    
    if (!note_id) {
      return c.json({ error: 'note_id is required' }, 400)
    }
    
    const existing = await sql`SELECT * FROM knowledgebase WHERE id = ${id}`
    if (!existing.length) {
      return c.json({ error: 'Knowledgebase not found' }, 404)
    }
    
    // Update the note's knowledgebase_id
    await sql`UPDATE notes SET knowledgebase_id = ${id} WHERE id = ${note_id}`
    
    // Add note ID to knowledgebase notes_ids array
    const result = await sql`
      UPDATE knowledgebase 
      SET notes_ids = array_append(
        array_remove(notes_ids, ${String(note_id)}), 
        ${String(note_id)}
      ),
      updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `
    
    return c.json({ success: true, knowledgebase: result[0] })
  } catch (error) {
    console.error('Error adding note to knowledgebase:', error)
    return c.json({ error: 'Failed to add note' }, 500)
  }
})

// =============================================================================
// DELETE /knowledgebase/:id/notes/:noteId - Remove note from knowledgebase
// =============================================================================
knowledgebaseRoutes.delete('/:id/notes/:noteId', async (c) => {
  const id = c.req.param('id')
  const noteId = c.req.param('noteId')
  
  try {
    const existing = await sql`SELECT * FROM knowledgebase WHERE id = ${id}`
    if (!existing.length) {
      return c.json({ error: 'Knowledgebase not found' }, 404)
    }
    
    // Remove knowledgebase_id from the note
    await sql`UPDATE notes SET knowledgebase_id = NULL WHERE id = ${noteId}`
    
    // Remove note ID from knowledgebase notes_ids array
    const result = await sql`
      UPDATE knowledgebase 
      SET notes_ids = array_remove(notes_ids, ${noteId}),
      updated_at = NOW()
      WHERE id = ${id}
      RETURNING *
    `
    
    return c.json({ success: true, knowledgebase: result[0] })
  } catch (error) {
    console.error('Error removing note from knowledgebase:', error)
    return c.json({ error: 'Failed to remove note' }, 500)
  }
})

// =============================================================================
// GET /knowledgebase/:id/notes - Get all notes for a knowledgebase
// =============================================================================
knowledgebaseRoutes.get('/:id/notes', async (c) => {
  const id = c.req.param('id')
  
  try {
    const existing = await sql`SELECT * FROM knowledgebase WHERE id = ${id}`
    if (!existing.length) {
      return c.json({ error: 'Knowledgebase not found' }, 404)
    }
    
    const notes = await sql`
      SELECT * FROM notes 
      WHERE knowledgebase_id = ${id}
      ORDER BY id DESC
    `
    
    return c.json({ notes })
  } catch (error) {
    console.error('Error fetching knowledgebase notes:', error)
    return c.json({ error: 'Failed to fetch notes' }, 500)
  }
})

export default knowledgebaseRoutes
