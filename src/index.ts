import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { sql } from './utils/neon.js'
import { authMiddleware } from './middlewares/auth.middleware.js'
import { cors } from 'hono/cors'
import { invokeLLM } from './utils/ollama.js'
import { search } from './functions/search.js'
import { uploadBase64Image } from './utils/vercelCloud.js'
import { searchUserNotes, formatNoteSearchResponse } from './utils/noteSearch.js'
import { validateFile, parseDocument } from './utils/documentParser.js'
import knowledgebaseRoutes from './routes/knowledgebase.js'
import corpusRoutes from './routes/corpus.js'
import axios from 'axios'


const app = new Hono()
app.use(
  '/*',
  cors({
    origin: ['https://cogniva.pages.dev'],                     
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],   
    allowHeaders: ['Content-Type', 'Authorization'],  
    maxAge: 600,
    credentials: false               
  })
)

// =============================================================================
// Knowledgebase Routes
// =============================================================================
app.route('/knowledgebase', knowledgebaseRoutes)

// =============================================================================
// Corpus Routes
// =============================================================================
app.route('/corpus', corpusRoutes)

app.get('/', (c) => {
  return c.text('Hello Hono!')
})


app.get('/user', authMiddleware, (c) => {
  //@ts-ignore
  const user = c.get('user')
  return c.json({ message: `User,`, user })
})

app.get('/chats/:uid', async (c) => {
  const result = await sql`SELECT * FROM chats WHERE user_id = ${c.req.param('uid')}`
  return c.json(result)
})

app.delete('/chats/:id', async (c) => {
  const id = c.req.param('id')
  await sql`DELETE FROM chats WHERE id = ${id}`
  return c.json({ success: true })
})

app.post('/save-chat', async (c) => {
  let { userId, messages, chatId=null } = await c.req.json()
  let result;
  if (chatId) {
  result = await sql`UPDATE chats SET messages = ${messages} WHERE id = ${chatId} RETURNING *`
  } else{
  result = await sql`INSERT INTO chats (user_id, messages) VALUES (${userId}, ${messages}) RETURNING *`
  }
  return c.json(result)
})

// =============================================================================
// Notes API - CRUD operations for user notes
// =============================================================================

app.get('/notes/:uid', async (c) => {
  const uid = c.req.param('uid')
  const result = await sql`SELECT * FROM notes WHERE user_id = ${uid} ORDER BY id DESC`
  return c.json(result)
})

app.post('/notes', async (c) => {
  const { userId, title, body } = await c.req.json()
  if (!userId || !title) {
    return c.json({ error: 'userId and title are required' }, 400)
  }
  const result = await sql`INSERT INTO notes (user_id, title, body) VALUES (${userId}, ${title}, ${body || ''}) RETURNING *`
  return c.json(result[0])
})

app.put('/notes/:id', async (c) => {
  const id = c.req.param('id')
  const { title, body } = await c.req.json()
  const result = await sql`UPDATE notes SET title = ${title}, body = ${body} WHERE id = ${id} RETURNING *`
  return c.json(result[0])
})

app.delete('/notes/:id', async (c) => {
  const id = c.req.param('id')
  await sql`DELETE FROM notes WHERE id = ${id}`
  return c.json({ success: true })
})

// =============================================================================
// Document Upload API - Upload and convert documents to notes
// =============================================================================

app.post('/upload-document', async (c) => {
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

app.post('/chat', async (c) => {
  const { messages, schema } = await c.req.json()
  const response = await invokeLLM(messages, schema)
  return c.json(response)
})

// =============================================================================
// Notes Search API - Semantic search through user's notes
// =============================================================================

app.post('/search-notes', async (c) => {
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
      sources: formattedNotes.map(note => ({
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

app.get('/scrap-url', async (c) => {
  const url = c.req.query('url')
  if (!url) {
    return c.json({ error: 'URL query parameter is required' }, 400)
  }
  try {
    const { scrapUrl } = await import('./functions/scrapUrl.js')
    const data = await scrapUrl(url)
    return c.json(data)
  } catch (error) {
    //@ts-ignore
    return c.json({ error: error?.message }, 500) 
  }
})


app.get('/search', async (c) => {
  const q = c.req.query('q')
  if (!q) {
    return c.json({ error: 'q query parameter is required' }, 400)
  }
  try {
    const result = await search(q)
    return c.json(result)
  } catch (error) {
    //@ts-ignore
    return c.json({ error: error?.message }, 500)
  }
})

app.post('/summarize-html', async (c) => {
  const { htmlContent } = await c.req.json()
  if (!htmlContent) {
    return c.json({ error: 'htmlContent is required' }, 400)
  }

  const schema = 
    [{
      blockType: 'text || code || image || link',
      description: 'string(The type of content block.)',
      content: 'string(A Markdown formatted text for text blocks, code snippet for code blocks, URL for image and link blocks.)',
    }]
  
  const systemPrompt = `You are a web content presenter. You extract and summarize the main content of a web page for user, focusing on key points, code snippets if found, and important details. Avoid unnecessary information like ads, navigation menus, or unrelated content. Present the summary in a clear and concise manner. You must respond in this schema: ${JSON.stringify(schema)}
  This schema has a guideline:
  - Use 'text' blockType for regular text content.
  - Use 'code' blockType for any code snippets found within the HTML, not the HTML itself, but something like a tutorial or example code found within the page. This block should not be used for HTML or CSS code of the webpage. and it should be avoided for general webpages except programming-related content like blogs or documentation.
  - Use 'image' blockType for any important images, providing the image URL in the content field.
  - Use 'link' blockType for any significant hyperlinks, providing the URL in the content field.
  Ensure that the final output strictly adheres to the provided schema and guidelines.
  `
  const userMessage = `Please summarize the following HTML content:\n\n${htmlContent}, ensuring this schema is followed: ${JSON.stringify(schema)}`
  
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'human', content: userMessage }
  ] as any

  try {
    const response = await invokeLLM(messages, schema)
    return c.json(Array?.isArray(response) ? response.flat() : [response])
  } catch (error) {
    //@ts-ignore
    return c.json({ error: error?.message }, 500)
  }
})

app.post('/upload-image', async (c) => {
  const { dataUri, fileName } = await c.req.json()
  if (!dataUri || !fileName) {
    return c.json({ error: 'dataUri and fileName are required' }, 400)
  }
  try {
    // const { uploadBase64Image } = await import('./utils/vercelCloud.js')
    const result = await uploadBase64Image(dataUri, fileName)
    return c.json({ url: result.url })
  } catch (error) {
    //@ts-ignore
    return c.json({ error: error?.message }, 500)
  }
})

// =============================================================================
// Separate Web Answer APIs - Each returns one type of result
// =============================================================================

const PYTHON_API_BASE = 'https://inferencia-search.vercel.app'

app.post('/wikipedia-answer', async (c) => {
  const { question } = await c.req.json()
  if (!question) {
    return c.json({ error: 'question is required' }, 400)
  }
  try {
    const res = await axios.post(`${PYTHON_API_BASE}/api/wikipedia-answer`, { question })
    const { wikipedia_answer } = res.data || {}
    
    if (wikipedia_answer?.summary) {
      const summarized = await invokeLLM([
        { role: 'system', content: 'Summarize the following Wikipedia result in 3 concise sentences. Keep it factual and brief.' },
        { role: 'human', content: wikipedia_answer.summary }
      ])
      return c.json({
        wikipedia_answer: {
          ...wikipedia_answer,
          summary: summarized[0]?.response || wikipedia_answer.summary
        }
      })
    }
    return c.json({ wikipedia_answer })
  } catch (error) {
    //@ts-ignore
    return c.json({ error: error?.message }, 500)
  }
})

app.post('/duckduckgo-answer', async (c) => {
  const { question } = await c.req.json()
  if (!question) {
    return c.json({ error: 'question is required' }, 400)
  }
  try {
    const res = await axios.post(`${PYTHON_API_BASE}/api/duckduckgo-answer`, { question })
    const { duckduckgo_answer } = res.data || {}
    
    if (duckduckgo_answer?.answer) {
      const summarized = await invokeLLM([
        { role: 'system', content: 'Summarize the following DuckDuckGo result in 3 concise sentences. Keep it factual and brief.' },
        { role: 'human', content: duckduckgo_answer.answer }
      ])
      return c.json({
        duckduckgo_answer: {
          ...duckduckgo_answer,
          answer: summarized[0]?.response || duckduckgo_answer.answer
        }
      })
    }
    return c.json({ duckduckgo_answer })
  } catch (error) {
    //@ts-ignore
    return c.json({ error: error?.message }, 500)
  }
})

app.post('/promoted-answer', async (c) => {
  const { question } = await c.req.json()
  if (!question) {
    return c.json({ error: 'question is required' }, 400)
  }
  try {
    const res = await axios.post(`${PYTHON_API_BASE}/api/promoted-answer`, { question })
    return c.json(res.data)
  } catch (error) {
    //@ts-ignore
    return c.json({ error: error?.message }, 500)
  }
})

app.post('/others-answer', async (c) => {
  const { question } = await c.req.json()
  if (!question) {
    return c.json({ error: 'question is required' }, 400)
  }
  try {
    const res = await axios.post(`${PYTHON_API_BASE}/api/others-answer`, { question })
    return c.json(res.data)
  } catch (error) {
    //@ts-ignore
    return c.json({ error: error?.message }, 500)
  }
})

app.post('/articles-answer', async (c) => {
  const { question } = await c.req.json()
  if (!question) {
    return c.json({ error: 'question is required' }, 400)
  }
  try {
    const res = await axios.post(`${PYTHON_API_BASE}/api/articles-answer`, { question })
    return c.json(res.data)
  } catch (error) {
    //@ts-ignore
    return c.json({ error: error?.message }, 500)
  }
})

// =============================================================================
// Legacy Combined Web Answer API (kept for backward compatibility)
// =============================================================================

app.post('/web-answer', async (c) => {
  const { question } = await c.req.json()
  const res = await axios.post('https://inferencia-search.vercel.app/api/answer-question', { question })
  const oneAnswer = await invokeLLM([{ role: 'system', content: 'Your job is to extract a concise answer of this question: ' + question + ' from the following json data: ' + JSON.stringify(res.data) }, { role: 'human', content: 'Provide a concise answer based on the above data, if you cannot find an answer just output "toolCall(Tavilly)" and nothing' }])
  if (oneAnswer[0]?.response?.toLowerCase() === 'toolCall(Tavilly)'?.toLowerCase()) {
    const tavilySearch = await search(question)
    const finalResponse = { answer: tavilySearch.answer, image: tavilySearch.images[0]?.url, ...res.data }
    return c.json(finalResponse)
  } else {
  // return c.json(res.data)
  const finalResponse = { answer: oneAnswer[0]?.response, ...res.data }
  return c.json(finalResponse)
  }
})

serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
