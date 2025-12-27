import { Hono } from 'hono'
import axios from 'axios'
import { invokeLLM } from '../utils/ollamaEnhanced.js'
import { search } from '../functions/search.js'

// =============================================================================
// Web Search Constants
// =============================================================================

const PYTHON_API_BASE = 'https://inferencia-search.vercel.app'

// =============================================================================
// Web Search Routes
// =============================================================================

const webSearchRoutes = new Hono()

// =============================================================================
// POST /web-search/wikipedia - Get Wikipedia answer
// =============================================================================
webSearchRoutes.post('/wikipedia', async (c) => {
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
        { role: 'human', content: wikipedia_answer.summary },
      ])
      return c.json({
        wikipedia_answer: {
          ...wikipedia_answer,
          summary: summarized[0]?.response || wikipedia_answer.summary,
        },
      })
    }
    return c.json({ wikipedia_answer })
  } catch (error) {
    //@ts-ignore
    return c.json({ error: error?.message }, 500)
  }
})

// =============================================================================
// POST /web-search/duckduckgo - Get DuckDuckGo answer
// =============================================================================
webSearchRoutes.post('/duckduckgo', async (c) => {
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
        { role: 'human', content: duckduckgo_answer.answer },
      ])
      return c.json({
        duckduckgo_answer: {
          ...duckduckgo_answer,
          answer: summarized[0]?.response || duckduckgo_answer.answer,
        },
      })
    }
    return c.json({ duckduckgo_answer })
  } catch (error) {
    //@ts-ignore
    return c.json({ error: error?.message }, 500)
  }
})

// =============================================================================
// POST /web-search/promoted - Get promoted answer
// =============================================================================
webSearchRoutes.post('/promoted', async (c) => {
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

// =============================================================================
// POST /web-search/others - Get other web results
// =============================================================================
webSearchRoutes.post('/others', async (c) => {
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

// =============================================================================
// POST /web-search/articles - Get articles answer
// =============================================================================
webSearchRoutes.post('/articles', async (c) => {
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
// POST /web-search/combined - Legacy combined web answer API
// =============================================================================
webSearchRoutes.post('/combined', async (c) => {
  const { question } = await c.req.json()
  const res = await axios.post('https://inferencia-search.vercel.app/api/answer-question', { question })
  const oneAnswer = await invokeLLM([
    { role: 'system', content: 'Your job is to extract a concise answer of this question: ' + question + ' from the following json data: ' + JSON.stringify(res.data) },
    { role: 'human', content: 'Provide a concise answer based on the above data, if you cannot find an answer just output "toolCall(Tavilly)" and nothing' },
  ])
  if (oneAnswer[0]?.response?.toLowerCase() === 'toolCall(Tavilly)'?.toLowerCase()) {
    const tavilySearch = await search(question)
    const finalResponse = { answer: tavilySearch.answer, image: tavilySearch.images[0]?.url, ...res.data }
    return c.json(finalResponse)
  } else {
    const finalResponse = { answer: oneAnswer[0]?.response, ...res.data }
    return c.json(finalResponse)
  }
})

// =============================================================================
// GET /web-search/search - Generic search
// =============================================================================
webSearchRoutes.get('/search', async (c) => {
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

export default webSearchRoutes
