import { Hono } from 'hono'
import { sql } from '../utils/neon.js'

// =============================================================================
// Corpus Types
// =============================================================================

interface Comment {
  user_id: string
  comment_text: string
  created_at?: string
}

interface Corpus {
  id: number
  title: string | null
  body: string | null
  keywords: string[]
  knowledgebase_id: number | null
  liked_users_ids: string[]
  comments: Comment[]
  is_approved: boolean
}

// =============================================================================
// Corpus Routes
// =============================================================================

const corpusRoutes = new Hono()

// =============================================================================
// GET /corpus/:id - Get corpus by ID
// =============================================================================
corpusRoutes.get('/:id', async (c) => {
  const id = c.req.param('id')
  
  try {
    const result = await sql`SELECT * FROM corpus WHERE id = ${id}`
    
    if (!result.length) {
      return c.json({ error: 'Corpus not found' }, 404)
    }
    
    return c.json(result[0])
  } catch (error) {
    console.error('Error fetching corpus:', error)
    return c.json({ error: 'Failed to fetch corpus' }, 500)
  }
})

// =============================================================================
// POST /corpus - Create new corpus
// =============================================================================
corpusRoutes.post('/', async (c) => {
  try {
    const { title, body, keywords, knowledgebase_id, is_approved = false } = await c.req.json()
    
    if (!knowledgebase_id) {
      return c.json({ error: 'knowledgebase_id is required' }, 400)
    }
    
    const result = await sql`
      INSERT INTO corpus (title, body, keywords, knowledgebase_id, liked_users_ids, comments, is_approved)
      VALUES (
        ${title || null},
        ${body || null},
        ${keywords || []}::text[],
        ${knowledgebase_id},
        ARRAY[]::text[],
        ARRAY[]::jsonb[],
        ${is_approved}
      )
      RETURNING *
    `
    
    return c.json(result[0], 201)
  } catch (error) {
    console.error('Error creating corpus:', error)
    return c.json({ error: 'Failed to create corpus' }, 500)
  }
})

// =============================================================================
// PUT /corpus/:id - Update corpus
// =============================================================================
corpusRoutes.put('/:id', async (c) => {
  const id = c.req.param('id')
  
  try {
    const { title, body, keywords, is_approved } = await c.req.json()
    
    const existing = await sql`SELECT * FROM corpus WHERE id = ${id}`
    if (!existing.length) {
      return c.json({ error: 'Corpus not found' }, 404)
    }
    
    const result = await sql`
      UPDATE corpus 
      SET 
        title = COALESCE(${title ?? null}, title),
        body = COALESCE(${body ?? null}, body),
        keywords = COALESCE(${keywords ?? null}::text[], keywords),
        is_approved = COALESCE(${is_approved ?? null}, is_approved)
      WHERE id = ${id}
      RETURNING *
    `
    
    return c.json(result[0])
  } catch (error) {
    console.error('Error updating corpus:', error)
    return c.json({ error: 'Failed to update corpus' }, 500)
  }
})

// =============================================================================
// DELETE /corpus/:id - Delete corpus
// =============================================================================
corpusRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id')
  
  try {
    const existing = await sql`SELECT * FROM corpus WHERE id = ${id}`
    if (!existing.length) {
      return c.json({ error: 'Corpus not found' }, 404)
    }
    
    await sql`DELETE FROM corpus WHERE id = ${id}`
    
    return c.body(null, 204)
  } catch (error) {
    console.error('Error deleting corpus:', error)
    return c.json({ error: 'Failed to delete corpus' }, 500)
  }
})

// =============================================================================
// POST /corpus/:id/approve - Approve/unapprove corpus (toggle)
// =============================================================================
corpusRoutes.post('/:id/approve', async (c) => {
  const id = c.req.param('id')
  
  try {
    const { is_approved } = await c.req.json()
    
    const existing = await sql`SELECT * FROM corpus WHERE id = ${id}`
    if (!existing.length) {
      return c.json({ error: 'Corpus not found' }, 404)
    }
    
    const result = await sql`
      UPDATE corpus 
      SET is_approved = ${is_approved}
      WHERE id = ${id}
      RETURNING *
    `
    
    return c.json({ success: true, corpus: result[0] })
  } catch (error) {
    console.error('Error approving corpus:', error)
    return c.json({ error: 'Failed to approve corpus' }, 500)
  }
})

// =============================================================================
// POST /corpus/:id/like - Like corpus
// =============================================================================
corpusRoutes.post('/:id/like', async (c) => {
  const id = c.req.param('id')
  
  try {
    const { user_id } = await c.req.json()
    
    if (!user_id) {
      return c.json({ error: 'user_id is required' }, 400)
    }
    
    const existing = await sql`SELECT * FROM corpus WHERE id = ${id}`
    if (!existing.length) {
      return c.json({ error: 'Corpus not found' }, 404)
    }
    
    // Add user to liked_users_ids if not already liked
    const result = await sql`
      UPDATE corpus 
      SET liked_users_ids = array_append(
        array_remove(liked_users_ids, ${user_id}), 
        ${user_id}
      )
      WHERE id = ${id}
      RETURNING *
    `
    
    return c.json({ success: true, corpus: result[0] })
  } catch (error) {
    console.error('Error liking corpus:', error)
    return c.json({ error: 'Failed to like corpus' }, 500)
  }
})

// =============================================================================
// POST /corpus/:id/unlike - Unlike corpus
// =============================================================================
corpusRoutes.post('/:id/unlike', async (c) => {
  const id = c.req.param('id')
  
  try {
    const { user_id } = await c.req.json()
    
    if (!user_id) {
      return c.json({ error: 'user_id is required' }, 400)
    }
    
    const existing = await sql`SELECT * FROM corpus WHERE id = ${id}`
    if (!existing.length) {
      return c.json({ error: 'Corpus not found' }, 404)
    }
    
    const result = await sql`
      UPDATE corpus 
      SET liked_users_ids = array_remove(liked_users_ids, ${user_id})
      WHERE id = ${id}
      RETURNING *
    `
    
    return c.json({ success: true, corpus: result[0] })
  } catch (error) {
    console.error('Error unliking corpus:', error)
    return c.json({ error: 'Failed to unlike corpus' }, 500)
  }
})

// =============================================================================
// POST /corpus/:id/comment - Add comment to corpus
// =============================================================================
corpusRoutes.post('/:id/comment', async (c) => {
  const id = c.req.param('id')
  
  try {
    const { user_id, comment_text } = await c.req.json()
    
    if (!user_id || !comment_text) {
      return c.json({ error: 'user_id and comment_text are required' }, 400)
    }
    
    const existing = await sql`SELECT * FROM corpus WHERE id = ${id}`
    if (!existing.length) {
      return c.json({ error: 'Corpus not found' }, 404)
    }
    
    const newComment = {
      user_id,
      comment_text,
      created_at: new Date().toISOString()
    }
    
    const result = await sql`
      UPDATE corpus 
      SET comments = array_append(comments, ${JSON.stringify(newComment)}::jsonb)
      WHERE id = ${id}
      RETURNING *
    `
    
    return c.json({ success: true, corpus: result[0] })
  } catch (error) {
    console.error('Error adding comment:', error)
    return c.json({ error: 'Failed to add comment' }, 500)
  }
})

// =============================================================================
// DELETE /corpus/:id/comment - Delete comment from corpus
// =============================================================================
corpusRoutes.delete('/:id/comment', async (c) => {
  const id = c.req.param('id')
  
  try {
    const { user_id, created_at } = await c.req.json()
    
    if (!user_id || !created_at) {
      return c.json({ error: 'user_id and created_at are required' }, 400)
    }
    
    const existing = await sql`SELECT * FROM corpus WHERE id = ${id}`
    if (!existing.length) {
      return c.json({ error: 'Corpus not found' }, 404)
    }
    
    // Remove the specific comment
    const result = await sql`
      UPDATE corpus 
      SET comments = (
        SELECT COALESCE(array_agg(c), ARRAY[]::jsonb[])
        FROM unnest(comments) c
        WHERE NOT (c->>'user_id' = ${user_id} AND c->>'created_at' = ${created_at})
      )
      WHERE id = ${id}
      RETURNING *
    `
    
    return c.json({ success: true, corpus: result[0] })
  } catch (error) {
    console.error('Error deleting comment:', error)
    return c.json({ error: 'Failed to delete comment' }, 500)
  }
})

// =============================================================================
// POST /corpus/:id/save-to-notes - Save corpus to user's notes
// =============================================================================
corpusRoutes.post('/:id/save-to-notes', async (c) => {
  const id = c.req.param('id')
  
  try {
    const { user_id } = await c.req.json()
    
    if (!user_id) {
      return c.json({ error: 'user_id is required' }, 400)
    }
    
    const existing = await sql`SELECT * FROM corpus WHERE id = ${id}`
    if (!existing.length) {
      return c.json({ error: 'Corpus not found' }, 404)
    }
    
    const corpus = existing[0] as Corpus
    
    // Create a new note from the corpus content
    const noteResult = await sql`
      INSERT INTO notes (user_id, title, body)
      VALUES (
        ${user_id}, 
        ${corpus.title || 'Saved from Knowledgebase'}, 
        ${corpus.body || ''}
      )
      RETURNING *
    `
    
    return c.json({ success: true, note: noteResult[0] })
  } catch (error) {
    console.error('Error saving corpus to notes:', error)
    return c.json({ error: 'Failed to save to notes' }, 500)
  }
})

// =============================================================================
// GET /corpus/knowledgebase/:kbId - Get all corpus for a knowledgebase
// =============================================================================
corpusRoutes.get('/knowledgebase/:kbId', async (c) => {
  const kbId = c.req.param('kbId')
  const showDrafts = c.req.query('showDrafts') === 'true'
  
  try {
    let result
    if (showDrafts) {
      // Show all corpus (for admins/editors)
      result = await sql`
        SELECT * FROM corpus 
        WHERE knowledgebase_id = ${kbId}
        ORDER BY id DESC
      `
    } else {
      // Show only approved corpus (for subscribers)
      result = await sql`
        SELECT * FROM corpus 
        WHERE knowledgebase_id = ${kbId} AND is_approved = true
        ORDER BY id DESC
      `
    }
    
    return c.json({ corpus: result })
  } catch (error) {
    console.error('Error fetching corpus:', error)
    return c.json({ error: 'Failed to fetch corpus' }, 500)
  }
})

// =============================================================================
// POST /corpus/search - Search corpus using semantic search
// =============================================================================
corpusRoutes.post('/search', async (c) => {
  try {
    const { query, knowledgebase_id } = await c.req.json()
    
    if (!query) {
      return c.json({ error: 'query is required' }, 400)
    }
    
    // Get approved corpus from the specified knowledgebase or all knowledgebases
    let corpusList
    if (knowledgebase_id) {
      corpusList = await sql`
        SELECT * FROM corpus 
        WHERE knowledgebase_id = ${knowledgebase_id} AND is_approved = true
      `
    } else {
      corpusList = await sql`
        SELECT * FROM corpus 
        WHERE is_approved = true
      `
    }
    
    if (!corpusList.length) {
      return c.json({ corpus: [], message: 'No corpus found' })
    }
    
    // Prepare corpus contents for semantic search (title + keywords + body)
    const corpusContents = (corpusList as Corpus[]).map((item) => {
      const keywordsText = (item.keywords || []).join(' ')
      return `${item.title || ''}\n${keywordsText}\n${item.body || ''}`
    })
    
    // Perform semantic search using query-sense
    const { semanticSearch } = await import('query-sense')
    const searchResponse = await semanticSearch(query, corpusContents, {
      topK: 10,
      threshold: 0.3,
    })
    
    // Map results back to corpus
    const matchedCorpus = searchResponse.results.map((result: { document: string; score: number }) => {
      const corpusIndex = corpusContents.findIndex((content: string) => content === result.document)
      if (corpusIndex === -1) return null
      return {
        ...(corpusList as Corpus[])[corpusIndex],
        similarity: result.score,
      }
    }).filter((item): item is Corpus & { similarity: number } => item !== null)
    
    return c.json({
      corpus: matchedCorpus,
      sources: matchedCorpus.map((item) => ({
        title: item.title,
        snippet: (item.body || '').slice(0, 150),
        corpusId: item.id,
        similarity: item.similarity,
      })),
    })
  } catch (error) {
    console.error('Error searching corpus:', error)
    return c.json({ error: 'Failed to search corpus' }, 500)
  }
})

// =============================================================================
// POST /corpus/query - Query corpus for AI answers (used in chat)
// =============================================================================
corpusRoutes.post('/query', async (c) => {
  try {
    const { question, knowledgebase_id } = await c.req.json()
    
    if (!question) {
      return c.json({ error: 'question is required' }, 400)
    }
    
    // Get approved corpus from the specified knowledgebase or all knowledgebases
    let corpusList
    if (knowledgebase_id) {
      corpusList = await sql`
        SELECT * FROM corpus 
        WHERE knowledgebase_id = ${knowledgebase_id} AND is_approved = true
      `
    } else {
      corpusList = await sql`
        SELECT * FROM corpus 
        WHERE is_approved = true
      `
    }
    
    if (!corpusList.length) {
      return c.json({ corpus: [], message: 'No corpus found in knowledgebase' })
    }
    
    // Prepare corpus contents for semantic search
    const corpusContents = (corpusList as Corpus[]).map((item) => {
      const keywordsText = (item.keywords || []).join(' ')
      return `${item.title || ''}\n${keywordsText}\n${item.body || ''}`
    })
    
    // Perform semantic search using query-sense
    const { semanticSearch } = await import('query-sense')
    const searchResponse = await semanticSearch(question, corpusContents, {
      topK: 5,
      threshold: 0.5,
    })
    
    // Map results back to corpus
    const matchedCorpus = searchResponse.results.map((result: { document: string; score: number }) => {
      const corpusIndex = corpusContents.findIndex((content: string) => content === result.document)
      if (corpusIndex === -1) return null
      return {
        ...(corpusList as Corpus[])[corpusIndex],
        similarity: result.score,
      }
    }).filter((item): item is Corpus & { similarity: number } => item !== null)
    
    return c.json({
      corpus: matchedCorpus,
      sources: matchedCorpus.map((item) => ({
        title: item.title,
        url: `corpus://${item.id}`,
        snippet: (item.body || '').slice(0, 150),
        corpusId: item.id,
      })),
    })
  } catch (error) {
    console.error('Error querying corpus:', error)
    return c.json({ error: 'Failed to query corpus' }, 500)
  }
})

// =============================================================================
// POST /corpus/query-subscribed - Query corpus from user's subscribed knowledgebases
// This is used by the chat system to find relevant content for AI responses
// =============================================================================
corpusRoutes.post('/query-subscribed', async (c) => {
  try {
    const { user_id, question } = await c.req.json()
    
    if (!user_id || !question) {
      return c.json({ error: 'user_id and question are required' }, 400)
    }
    
    // Get all knowledgebases where user is subscribed
    const subscribedKnowledgebases = await sql`
      SELECT id, name FROM knowledgebase 
      WHERE ${user_id} = ANY(subscribers_ids)
    `
    
    if (!subscribedKnowledgebases.length) {
      return c.json({ corpus: [], message: 'User is not subscribed to any knowledgebases' })
    }
    
    const kbIds = subscribedKnowledgebases.map((kb: { id: number }) => kb.id)
    
    // Get approved corpus from all subscribed knowledgebases
    const corpusList = await sql`
      SELECT c.*, k.name as knowledgebase_name 
      FROM corpus c
      JOIN knowledgebase k ON c.knowledgebase_id = k.id
      WHERE c.knowledgebase_id = ANY(${kbIds}::int[]) AND c.is_approved = true
    `
    
    if (!corpusList.length) {
      return c.json({ corpus: [], message: 'No published content found in subscribed knowledgebases' })
    }
    
    // Prepare corpus contents for semantic search
    const corpusContents = (corpusList as (Corpus & { knowledgebase_name: string })[]).map((item) => {
      const keywordsText = (item.keywords || []).join(' ')
      return `${item.title || ''}\n${keywordsText}\n${item.body || ''}`
    })
    
    // Perform semantic search using query-sense
    const { semanticSearch } = await import('query-sense')
    const searchResponse = await semanticSearch(question, corpusContents, {
      topK: 5,
      threshold: 0.4,
    })
    
    // Map results back to corpus with knowledgebase info
    const matchedCorpus = searchResponse.results.map((result: { document: string; score: number }) => {
      const corpusIndex = corpusContents.findIndex((content: string) => content === result.document)
      if (corpusIndex === -1) return null
      return {
        ...(corpusList as (Corpus & { knowledgebase_name: string })[])[corpusIndex],
        similarity: result.score,
      }
    }).filter((item): item is Corpus & { knowledgebase_name: string; similarity: number } => item !== null)
    
    if (!matchedCorpus.length) {
      return c.json({ corpus: [], message: 'No relevant content found for your query' })
    }
    
    return c.json({
      type: 'corpus',
      topic: 'From Your Knowledgebases',
      corpus: matchedCorpus.map((item) => ({
        corpusId: item.id,
        title: item.title,
        body: item.body,
        knowledgebaseName: item.knowledgebase_name,
        knowledgebaseId: item.knowledgebase_id,
        keywords: item.keywords,
        similarity: item.similarity,
      })),
      sources: matchedCorpus.map((item) => ({
        title: item.title || 'Untitled',
        url: `corpus://${item.id}`,
        snippet: (item.body || '').replace(/<[^>]*>/g, '').slice(0, 150),
        corpusId: item.id,
        knowledgebaseName: item.knowledgebase_name,
      })),
    })
  } catch (error) {
    console.error('Error querying subscribed corpus:', error)
    return c.json({ error: 'Failed to query subscribed corpus' }, 500)
  }
})

export default corpusRoutes
