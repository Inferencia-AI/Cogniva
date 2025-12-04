import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { sql } from './utils/neon.ts'
import { authMiddleware } from './middlewares/auth.middleware.ts'
import { cors } from 'hono/cors'
import { invokeLLM } from './utils/ollama.ts'

const app = new Hono()
app.use(
  '/*',
  cors({
    origin: '*',                     
    allowMethods: ['GET', 'POST'],   
    allowHeaders: ['Content-Type', 'Authorization'],  
    maxAge: 600,
    credentials: false               
  })
)

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

app.get('/db-test', async (c) => {
  const result = await sql`SELECT * FROM playing_with_neon;`
  return c.json(result)
})

app.get('/user', authMiddleware, (c) => {
  //@ts-ignore
  const user = c.get('user')
  return c.json({ message: `User,`, user })
})

app.post('/chat', async (c) => {
  const { messages, schema } = await c.req.json()
  const response = await invokeLLM(messages, schema)
  return c.json(response)
})

serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
