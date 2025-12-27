import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { authMiddleware } from './middlewares/auth.middleware.js'

// =============================================================================
// Route Imports
// =============================================================================
import knowledgebaseRoutes from './routes/knowledgebase.js'
import corpusRoutes from './routes/corpus.js'
import notesRoutes from './routes/notes.js'
import chatRoutes from './routes/chat.js'
import webSearchRoutes from './routes/webSearch.js'
import contentRoutes from './routes/content.js'
import verifyAnswerRoutes from './routes/verifyAnswer.js'

// =============================================================================
// App Configuration
// =============================================================================

const app = new Hono()

app.use(
  '/*',
  cors({
    origin: ['https://cogniva.pages.dev'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowHeaders: ['Content-Type', 'Authorization'],
    maxAge: 600,
    credentials: false,
  })
)

// =============================================================================
// Route Registration
// =============================================================================

// Knowledgebase management
app.route('/knowledgebase', knowledgebaseRoutes)

// Corpus management (knowledge articles within knowledgebases)
app.route('/corpus', corpusRoutes)

// Notes management
app.route('/notes', notesRoutes)

// Chat and AI interactions
app.route('/chat', chatRoutes)

// Web search endpoints
app.route('/web-search', webSearchRoutes)

// Content processing (scraping, images, HTML)
app.route('/content', contentRoutes)

// Verify answer / classification
app.route('/verify-answer', verifyAnswerRoutes)

// =============================================================================
// Legacy Routes (for backward compatibility)
// =============================================================================

// Legacy chat endpoints - redirect to new structure
app.get('/chats/:uid', async (c) => {
  const response = await app.fetch(new Request(`http://localhost/chat/history/${c.req.param('uid')}`))
  return response
})

app.delete('/chats/:id', async (c) => {
  const response = await app.fetch(new Request(`http://localhost/chat/${c.req.param('id')}`, { method: 'DELETE' }))
  return response
})

app.post('/save-chat', async (c) => {
  const body = await c.req.json()
  const response = await app.fetch(new Request('http://localhost/chat/save', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }))
  return response
})

app.post('/search-notes', async (c) => {
  const body = await c.req.json()
  const response = await app.fetch(new Request('http://localhost/chat/search-notes', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }))
  return response
})

app.post('/upload-document', async (c) => {
  const formData = await c.req.formData()
  const response = await app.fetch(new Request('http://localhost/notes/upload-document', {
    method: 'POST',
    body: formData,
  }))
  return response
})

// Legacy web search endpoints
app.post('/wikipedia-answer', async (c) => {
  const body = await c.req.json()
  const response = await app.fetch(new Request('http://localhost/web-search/wikipedia', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }))
  return response
})

app.post('/duckduckgo-answer', async (c) => {
  const body = await c.req.json()
  const response = await app.fetch(new Request('http://localhost/web-search/duckduckgo', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }))
  return response
})

app.post('/promoted-answer', async (c) => {
  const body = await c.req.json()
  const response = await app.fetch(new Request('http://localhost/web-search/promoted', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }))
  return response
})

app.post('/others-answer', async (c) => {
  const body = await c.req.json()
  const response = await app.fetch(new Request('http://localhost/web-search/others', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }))
  return response
})

app.post('/articles-answer', async (c) => {
  const body = await c.req.json()
  const response = await app.fetch(new Request('http://localhost/web-search/articles', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }))
  return response
})

app.post('/web-answer', async (c) => {
  const body = await c.req.json()
  const response = await app.fetch(new Request('http://localhost/web-search/combined', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }))
  return response
})

app.get('/search', async (c) => {
  const q = c.req.query('q')
  const response = await app.fetch(new Request(`http://localhost/web-search/search?q=${q}`))
  return response
})

app.get('/scrap-url', async (c) => {
  const url = c.req.query('url')
  const response = await app.fetch(new Request(`http://localhost/content/scrap-url?url=${url}`))
  return response
})

app.post('/summarize-html', async (c) => {
  const body = await c.req.json()
  const response = await app.fetch(new Request('http://localhost/content/summarize-html', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }))
  return response
})

app.post('/upload-image', async (c) => {
  const body = await c.req.json()
  const response = await app.fetch(new Request('http://localhost/content/upload-image', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  }))
  return response
})

// =============================================================================
// Core Routes
// =============================================================================

app.get('/', (c) => {
  return c.text('Cogniva API v1.0')
})

app.get('/user', authMiddleware, (c) => {
  //@ts-ignore
  const user = c.get('user')
  return c.json({ message: `User,`, user })
})

// =============================================================================
// Server Startup
// =============================================================================

serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  (info) => {
    console.log(`Cogniva API server running on http://localhost:${info.port}`)
  }
)
