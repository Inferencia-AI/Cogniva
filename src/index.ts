import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { sql } from './utils/neon.js'
import { authMiddleware } from './middlewares/auth.middleware.js'
import { cors } from 'hono/cors'
import { invokeLLM } from './utils/ollama.js'
import { search } from './functions/search.js'
import { uploadBase64Image } from './utils/vercelCloud.js'
import axios from 'axios'


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

app.post('/web-answer', async (c) => {
  const { question } = await c.req.json()
  const res = await axios.post('https://inferencia-search.vercel.app/api/answer-question', { question })
  const oneAnswer = await invokeLLM([{ role: 'system', content: 'Your job is to extract a concise answer of this question: ' + question + ' from the following json data: ' + JSON.stringify(res.data) }, { role: 'human', content: 'Provide a concise answer based on the above data.' }])
  // return c.json(res.data)
  const finalResponse = { answer: oneAnswer[0]?.response, ...res.data }
  return c.json(finalResponse)
})

app.get('/test-puppeteer', async (c) => {
  const { getTitle } = await import('./functions/browser/puppeteer.js')
  const title =  await getTitle()
  return c.json({ title })
})

serve({
  fetch: app.fetch,
  port: 3000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
