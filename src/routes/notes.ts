import { Hono } from 'hono'
import { sql } from '../utils/neon.js'
import { validateFile, parseDocument } from '../utils/documentParser.js'

// =============================================================================
// Notes Types
// =============================================================================

export interface Note {
  id: number
  user_id: string
  title: string
  body: string
  knowledgebase_id?: number
}

// =============================================================================
// Notes Routes
// =============================================================================

const notesRoutes = new Hono()

// =============================================================================
// GET /notes/:uid - Get all notes for a user
// =============================================================================
notesRoutes.get('/:uid', async (c) => {
  const uid = c.req.param('uid')
  const result = await sql`SELECT * FROM notes WHERE user_id = ${uid} ORDER BY id DESC`
  return c.json(result)
})

// =============================================================================
// POST /notes - Create a new note
// =============================================================================
notesRoutes.post('/', async (c) => {
  const { userId, title, body } = await c.req.json()
  if (!userId || !title) {
    return c.json({ error: 'userId and title are required' }, 400)
  }
  const result = await sql`INSERT INTO notes (user_id, title, body) VALUES (${userId}, ${title}, ${body || ''}) RETURNING *`
  return c.json(result[0])
})

// =============================================================================
// PUT /notes/:id - Update a note
// =============================================================================
notesRoutes.put('/:id', async (c) => {
  const id = c.req.param('id')
  const { title, body } = await c.req.json()
  const result = await sql`UPDATE notes SET title = ${title}, body = ${body} WHERE id = ${id} RETURNING *`
  return c.json(result[0])
})

// =============================================================================
// DELETE /notes/:id - Delete a note
// =============================================================================
notesRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id')
  await sql`DELETE FROM notes WHERE id = ${id}`
  return c.json({ success: true })
})

// =============================================================================
// POST /notes/upload-document - Upload and convert documents to notes
// =============================================================================
notesRoutes.post('/upload-document', async (c) => {
  try {
    const formData = await c.req.formData()
    const file = formData.get('file') as File | null
    const userId = formData.get('userId') as string | null

    if (!file || !userId) {
      return c.json({ error: 'file and userId are required' }, 400)
    }

    // Validate file
    const validationError = validateFile(file.name, file.size, file.type)
    if (validationError) {
      return c.json(validationError, 400)
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Parse document to HTML
    const parsedDoc = await parseDocument(buffer, file.name, file.type)

    // Create note with the parsed content
    const result = await sql`
      INSERT INTO notes (user_id, title, body) 
      VALUES (${userId}, ${parsedDoc.title}, ${parsedDoc.html}) 
      RETURNING *
    `

    return c.json({
      success: true,
      note: result[0],
      metadata: {
        originalFileName: parsedDoc.originalFileName,
        fileSize: parsedDoc.fileSize,
        mimeType: parsedDoc.mimeType,
      },
    })
  } catch (error) {
    console.error('Error uploading document:', error)
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to process document', code: 'PARSE_ERROR' },
      500
    )
  }
})

export default notesRoutes
