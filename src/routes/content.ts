import { Hono } from 'hono'
import { invokeLLM } from '../utils/ollama.js'
import { uploadBase64Image } from '../utils/vercelCloud.js'

// =============================================================================
// Content Routes - Image upload and HTML summarization
// =============================================================================

const contentRoutes = new Hono()

// =============================================================================
// GET /content/scrap-url - Scrape a URL
// =============================================================================
contentRoutes.get('/scrap-url', async (c) => {
  const url = c.req.query('url')
  if (!url) {
    return c.json({ error: 'URL query parameter is required' }, 400)
  }
  try {
    const { scrapUrl } = await import('../functions/scrapUrl.js')
    const data = await scrapUrl(url)
    return c.json(data)
  } catch (error) {
    //@ts-ignore
    return c.json({ error: error?.message }, 500)
  }
})

// =============================================================================
// POST /content/summarize-html - Summarize HTML content
// =============================================================================
contentRoutes.post('/summarize-html', async (c) => {
  const { htmlContent } = await c.req.json()
  if (!htmlContent) {
    return c.json({ error: 'htmlContent is required' }, 400)
  }

  const schema = [
    {
      blockType: 'text || code || image || link',
      description: 'string(The type of content block.)',
      content: 'string(A Markdown formatted text for text blocks, code snippet for code blocks, URL for image and link blocks.)',
    },
  ]

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
    { role: 'human', content: userMessage },
  ] as any

  try {
    const response = await invokeLLM(messages, schema)
    return c.json(Array?.isArray(response) ? response.flat() : [response])
  } catch (error) {
    //@ts-ignore
    return c.json({ error: error?.message }, 500)
  }
})

// =============================================================================
// POST /content/upload-image - Upload an image
// =============================================================================
contentRoutes.post('/upload-image', async (c) => {
  const { dataUri, fileName } = await c.req.json()
  if (!dataUri || !fileName) {
    return c.json({ error: 'dataUri and fileName are required' }, 400)
  }
  try {
    const result = await uploadBase64Image(dataUri, fileName)
    return c.json({ url: result.url })
  } catch (error) {
    //@ts-ignore
    return c.json({ error: error?.message }, 500)
  }
})

export default contentRoutes
