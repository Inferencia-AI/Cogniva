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


app.get('/user', authMiddleware, (c) => {
  //@ts-ignore
  const user = c.get('user')
  return c.json({ message: `User,`, user })
})

app.get('/chats/:uid', async (c) => {
  const result = await sql`SELECT * FROM chats WHERE user_id = ${c.req.param('uid')}`
  return c.json(result)
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
