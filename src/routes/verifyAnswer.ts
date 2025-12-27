import { Hono } from 'hono'
import { ClassifierClient } from 'cognitive-decision'

const verifyAnswerRoutes = new Hono()
const client = new ClassifierClient()

// POST / - Classify a provided sequence against labels
verifyAnswerRoutes.post('/', async (c) => {
  const body = await c.req.json()
  const sequence = body?.sequence
  const labels = body?.labels || ['corpus contain info', 'corpus does not contain info']

  if (!sequence || typeof sequence !== 'string') {
    return c.json({ error: 'sequence (string) is required' }, 400)
  }

  try {
    const resp = await client.classify(sequence, labels)
    return c.json(resp)
  } catch (error) {
    //@ts-ignore
    return c.json({ error: error?.message || String(error) }, 500)
  }
})

export default verifyAnswerRoutes
