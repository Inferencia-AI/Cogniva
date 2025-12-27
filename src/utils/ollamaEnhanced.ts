// =============================================================================
// Ollama LLM Utility - Enhanced with structured output and error handling
// =============================================================================

import { ChatOllama } from "@langchain/ollama"
import { HumanMessage, SystemMessage, AIMessage } from "@langchain/core/messages"
import type { BaseMessage } from "@langchain/core/messages"
//@ts-ignore
import extractJson from "extract-json-from-string"
import type { SchemaType } from '../types/agent.js'
import { getSchema, getSchemaForPrompt } from '../schemas/responseSchemas.js'

// =============================================================================
// Configuration
// =============================================================================

interface LLMConfig {
  model: string
  baseUrl: string
  temperature: number
  maxRetries: number
  retryDelay: number
  timeout: number
}

const DEFAULT_CONFIG: LLMConfig = {
  model: process.env.OLLAMA_MODEL || "gpt-oss:20b-cloud",
  baseUrl: process.env.OLLAMA_BASE_URL || "https://ollama.com",
  temperature: 0.7,
  maxRetries: 3,
  retryDelay: 1000,
  timeout: 60000,
}

// =============================================================================
// LLM Instance Management
// =============================================================================

let llmInstance: ChatOllama | null = null

function getLLM(config: Partial<LLMConfig> = {}): ChatOllama {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }

  if (!llmInstance || config.model || config.temperature) {
    llmInstance = new ChatOllama({
      model: finalConfig.model,
      baseUrl: finalConfig.baseUrl,
      temperature: finalConfig.temperature,
      headers: {
        "Authorization": `Bearer ${process.env.OLLAMA_API_KEY}`,
      },
    })
  }

  return llmInstance
}

// =============================================================================
// Message Types
// =============================================================================

export interface ChatMessage {
  role: "human" | "system" | "ai" | "tool"
  content: string
}

interface ParsedResponse {
  success: boolean
  data: unknown
  raw: string
  error?: string
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Convert ChatMessage to LangChain message format
 */
function toBaseMessage(msg: ChatMessage): BaseMessage {
  switch (msg.role) {
    case 'system':
      return new SystemMessage(msg.content)
    case 'ai':
      return new AIMessage(msg.content)
    case 'human':
    case 'tool':
    default:
      return new HumanMessage(msg.content)
  }
}

/**
 * Convert array of ChatMessages to LangChain messages
 */
function toBaseMessages(messages: ChatMessage[]): BaseMessage[] {
  return messages.map(toBaseMessage)
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Extract JSON from LLM response with multiple strategies
 */
function extractJsonSafe(text: string): unknown | null {
  if (!text || typeof text !== 'string') return null

  // Strategy 1: Direct JSON parse
  try {
    return JSON.parse(text)
  } catch {
    // Continue to other strategies
  }

  // Strategy 2: Extract from code blocks
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim())
    } catch {
      // Continue
    }
  }

  // Strategy 3: Find JSON object pattern
  const objectMatch = text.match(/\{[\s\S]*\}/)
  if (objectMatch) {
    try {
      return JSON.parse(objectMatch[0])
    } catch {
      // Continue
    }
  }

  // Strategy 4: Find JSON array pattern
  const arrayMatch = text.match(/\[[\s\S]*\]/)
  if (arrayMatch) {
    try {
      return JSON.parse(arrayMatch[0])
    } catch {
      // Continue
    }
  }

  // Strategy 5: Use extract-json library as fallback
  try {
    const extracted = extractJson(text)
    if (extracted && Array.isArray(extracted) && extracted.length > 0) {
      return extracted[0]
    }
    return extracted
  } catch {
    return null
  }
}

/**
 * Validate response against expected schema shape
 */
function validateResponse(data: unknown, expectedKeys: string[]): boolean {
  if (!data || typeof data !== 'object') return false
  const keys = Object.keys(data as object)
  return expectedKeys.some(key => keys.includes(key))
}

// =============================================================================
// Core LLM Functions
// =============================================================================

/**
 * Invoke LLM with retry logic and error handling
 */
export async function invokeLLM(
  messages: ChatMessage[],
  schema: object = { response: "string" },
  config: Partial<LLMConfig> = {}
): Promise<unknown[]> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }
  const llm = getLLM(config)

  // Prepare messages with schema instruction
  const systemPrompt: ChatMessage = {
    role: "system",
    content: `You are a helpful AI assistant. You MUST respond in valid JSON format following this schema exactly:
${JSON.stringify(schema, null, 2)}

Important:
- Only output valid JSON
- Do not include any text before or after the JSON
- Ensure all required fields are present`
  }

  // Convert AI messages content to strings if needed
  const formattedMessages = messages.map(msg => {
    if (msg.role === "ai" && typeof msg.content !== 'string') {
      return { ...msg, content: JSON.stringify(msg.content) }
    }
    return msg
  })

  // Convert to LangChain message format
  const langChainMessages = toBaseMessages([systemPrompt, ...formattedMessages])

  let lastError: Error | null = null

  for (let attempt = 0; attempt < finalConfig.maxRetries; attempt++) {
    try {
      const response = await llm.invoke(langChainMessages)
      const responseText = typeof response.content === 'string' 
        ? response.content 
        : JSON.stringify(response.content)

      const parsed = extractJsonSafe(responseText)

      if (parsed !== null) {
        return Array.isArray(parsed) ? parsed : [parsed]
      }

      // If parsing failed, try one more extraction
      const fallbackData = extractJson(responseText)
      if (fallbackData && fallbackData.length > 0) {
        return fallbackData
      }

      // Return raw text wrapped in response object
      return [{ text: responseText }]

    } catch (error) {
      lastError = error as Error
      console.error(`LLM invocation attempt ${attempt + 1} failed:`, error)

      if (attempt < finalConfig.maxRetries - 1) {
        await sleep(finalConfig.retryDelay * (attempt + 1)) // Exponential backoff
      }
    }
  }

  throw lastError || new Error("Failed to invoke LLM after maximum retries")
}

/**
 * Invoke LLM with structured output (typed)
 */
export async function invokeLLMStructured<T extends Record<string, unknown>>(
  messages: ChatMessage[],
  schema: { type: string; properties: Record<string, unknown>; required?: string[] },
  config: Partial<LLMConfig> = {}
): Promise<T> {
  const result = await invokeLLM(messages, schema, config)
  const data = Array.isArray(result) ? result[0] : result

  // Validate against required fields
  if (schema.required) {
    const missing = schema.required.filter(key => !(key in (data as object)))
    if (missing.length > 0) {
      console.warn(`Missing required fields: ${missing.join(', ')}`)
    }
  }

  return data as T
}

/**
 * Classify a query to determine intent and response type
 */
export async function classifyQuery(query: string): Promise<{
  intent: string
  responseType: SchemaType
  requiresTools: string[]
  complexity: string
  keywords: string[]
}> {
  const messages: ChatMessage[] = [
    { role: "human", content: query }
  ]

  const schema = {
    type: 'object',
    properties: {
      intent: {
        type: 'string',
        enum: ['question', 'code_request', 'explanation', 'comparison', 'task', 'creative', 'search', 'summary', 'instruction', 'conversation'],
      },
      responseType: {
        type: 'string',
        enum: ['conversational', 'code', 'analytical', 'search', 'task', 'creative', 'summary', 'comparison', 'instruction'],
      },
      requiresTools: {
        type: 'array',
        items: { type: 'string' },
      },
      complexity: {
        type: 'string',
        enum: ['simple', 'moderate', 'complex'],
      },
      keywords: {
        type: 'array',
        items: { type: 'string' },
      },
    },
    required: ['intent', 'responseType'],
  }

  try {
    const result = await invokeLLMStructured<{
      intent: string
      responseType: SchemaType
      requiresTools: string[]
      complexity: string
      keywords: string[]
    }>(messages, schema)

    return {
      intent: result.intent || 'question',
      responseType: result.responseType || 'conversational',
      requiresTools: result.requiresTools || [],
      complexity: result.complexity || 'simple',
      keywords: result.keywords || [],
    }
  } catch (error) {
    console.error("Error classifying query:", error)
    return {
      intent: 'question',
      responseType: 'conversational',
      requiresTools: [],
      complexity: 'simple',
      keywords: [],
    }
  }
}

/**
 * Generate a response using a specific schema type
 */
export async function generateResponse(
  messages: ChatMessage[],
  schemaType: SchemaType,
  config: Partial<LLMConfig> = {}
): Promise<Record<string, unknown>> {
  const schema = getSchema(schemaType)

  const result = await invokeLLM(messages, schema.schema, config)
  const data = Array.isArray(result) ? result[0] : result

  return data as Record<string, unknown>
}

/**
 * Generate a multi-schema response (LLM chooses best schema)
 */
export async function generateMultiSchemaResponse(
  messages: ChatMessage[],
  schemaTypes: SchemaType[],
  config: Partial<LLMConfig> = {}
): Promise<{ schemaUsed: SchemaType; response: Record<string, unknown> }> {
  // First classify to determine best schema
  const lastMessage = messages[messages.length - 1]
  const query = typeof lastMessage.content === 'string' ? lastMessage.content : ''

  const classification = await classifyQuery(query)
  const bestSchema = schemaTypes.includes(classification.responseType) 
    ? classification.responseType 
    : schemaTypes[0]

  const response = await generateResponse(messages, bestSchema, config)

  return {
    schemaUsed: bestSchema,
    response,
  }
}

/**
 * Simple chat completion (backward compatible)
 */
export async function chat(
  prompt: string,
  systemPrompt?: string,
  config: Partial<LLMConfig> = {}
): Promise<string> {
  const llm = getLLM(config)

  const messages: ChatMessage[] = []
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt })
  }
  messages.push({ role: "human", content: prompt })

  try {
    const langChainMessages = toBaseMessages(messages)
    const response = await llm.invoke(langChainMessages)
    return typeof response.content === 'string' 
      ? response.content 
      : JSON.stringify(response.content)
  } catch (error) {
    console.error("Chat error:", error)
    throw error
  }
}

/**
 * Summarize content
 */
export async function summarize(
  content: string,
  options: {
    maxWords?: number
    style?: 'bullet' | 'paragraph' | 'tldr'
  } = {}
): Promise<string> {
  const { maxWords = 100, style = 'paragraph' } = options

  const styleInstructions = {
    bullet: 'as bullet points',
    paragraph: 'as a concise paragraph',
    tldr: 'as a TL;DR (one or two sentences)',
  }

  const prompt = `Summarize the following content ${styleInstructions[style]}, keeping it under ${maxWords} words:

${content}`

  return chat(prompt, "You are a concise summarization expert.")
}

/**
 * Extract key information from content
 */
export async function extract(
  content: string,
  fields: string[]
): Promise<Record<string, string>> {
  const schema = {
    type: 'object',
    properties: fields.reduce((acc, field) => ({
      ...acc,
      [field]: { type: 'string' }
    }), {}),
    required: fields,
  }

  const result = await invokeLLMStructured<Record<string, string>>(
    [{ role: "human", content: `Extract the following information from this content: ${fields.join(', ')}\n\nContent:\n${content}` }],
    schema
  )

  return result
}

// =============================================================================
// Streaming Support (for future use)
// =============================================================================

export interface StreamCallbacks {
  onToken?: (token: string) => void
  onComplete?: (fullResponse: string) => void
  onError?: (error: Error) => void
}

/**
 * Stream LLM response (placeholder for future implementation)
 */
export async function streamLLM(
  messages: ChatMessage[],
  callbacks: StreamCallbacks,
  config: Partial<LLMConfig> = {}
): Promise<void> {
  // Note: Streaming requires additional setup with Ollama
  // This is a placeholder that falls back to non-streaming
  try {
    const result = await invokeLLM(messages, { response: 'string' }, config)
    const response = Array.isArray(result) ? JSON.stringify(result[0]) : JSON.stringify(result)
    
    callbacks.onToken?.(response)
    callbacks.onComplete?.(response)
  } catch (error) {
    callbacks.onError?.(error as Error)
  }
}

// =============================================================================
// Export
// =============================================================================

export {
  getLLM,
  extractJsonSafe,
  DEFAULT_CONFIG,
}

export default invokeLLM
