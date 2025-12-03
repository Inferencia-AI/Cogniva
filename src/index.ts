import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { sql } from './utils/neon.ts'
import { authMiddleware } from './middlewares/auth.middleware.ts'
import { cors } from 'hono/cors'

const app = new Hono()
app.use(
  '/*',
  cors({
    origin: '*',                     // or a specific domain: "https://your-frontend.com"
    allowMethods: ['GET', 'POST'],   // add PUT, PATCH, DELETE if needed
    allowHeaders: ['Content-Type', 'Authorization'],  // add Authorization, etc.
    maxAge: 600,
    credentials: false               // set true if you need cookies/auth
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

serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
