// =============================================================================
// Response Schemas - Structured output schemas for different response types
// =============================================================================

import type { ResponseSchema, SchemaType } from '../types/agent.js'

// =============================================================================
// Conversational Schema - For general dialogue
// =============================================================================
export const conversationalSchema: ResponseSchema = {
  type: 'conversational',
  name: 'Conversational Response',
  description: 'For general dialogue, questions, and casual interactions',
  schema: {
    type: 'object',
    properties: {
      topic: { type: 'string', description: 'Brief topic/subject of the response' },
      response: { type: 'string', description: 'The main response text' },
      followUp: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional follow-up questions or suggestions',
      },
      confidence: { type: 'number', description: 'Confidence score 0-1' },
    },
    required: ['topic', 'response'],
  },
  examples: [
    {
      topic: 'Weather Inquiry',
      response: 'The weather today is sunny with a high of 75°F. Perfect for outdoor activities!',
      followUp: ['Would you like a weekly forecast?', 'Should I suggest outdoor activities?'],
      confidence: 0.95,
    },
  ],
}

// =============================================================================
// Code Schema - For programming-related responses
// =============================================================================
export const codeSchema: ResponseSchema = {
  type: 'code',
  name: 'Code Response',
  description: 'For programming questions, code snippets, and technical explanations',
  schema: {
    type: 'object',
    properties: {
      topic: { type: 'string', description: 'Programming topic or problem' },
      explanation: { type: 'string', description: 'High-level explanation of the solution' },
      response: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            language: { type: 'string', description: 'Programming language' },
            code: { type: 'string', description: 'The code snippet' },
            filename: { type: 'string', description: 'Optional suggested filename' },
            description: { type: 'string', description: 'What this code block does' },
          },
          required: ['language', 'code'],
        },
        description: 'Array of code blocks',
      },
      confidence: { type: 'number', description: 'Confidence score 0-1' },
    },
    required: ['topic', 'response'],
  },
  examples: [
    {
      topic: 'React useState Hook',
      explanation: 'The useState hook allows you to add state to functional components.',
      response: [
        {
          language: 'typescript',
          code: "const [count, setCount] = useState<number>(0);\n\nconst increment = () => setCount(prev => prev + 1);",
          filename: 'Counter.tsx',
          description: 'Basic counter implementation using useState',
        },
      ],
      confidence: 0.98,
    },
  ],
}

// =============================================================================
// Analytical Schema - For data analysis and insights
// =============================================================================
export const analyticalSchema: ResponseSchema = {
  type: 'analytical',
  name: 'Analytical Response',
  description: 'For data analysis, insights, and structured breakdowns',
  schema: {
    type: 'object',
    properties: {
      topic: { type: 'string', description: 'Analysis topic' },
      analysis: { type: 'string', description: 'Main analysis text' },
      insights: {
        type: 'array',
        items: { type: 'string' },
        description: 'Key insights extracted from the analysis',
      },
      data: {
        type: 'object',
        description: 'Optional structured data supporting the analysis',
      },
      visualization: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['chart', 'table', 'graph', 'timeline'] },
          config: { type: 'object' },
        },
        description: 'Hint for how to visualize the data',
      },
      confidence: { type: 'number', description: 'Confidence score 0-1' },
    },
    required: ['topic', 'analysis', 'insights'],
  },
}

// =============================================================================
// Search Schema - For search results
// =============================================================================
export const searchSchema: ResponseSchema = {
  type: 'search',
  name: 'Search Response',
  description: 'For presenting search results in a structured format',
  schema: {
    type: 'object',
    properties: {
      topic: { type: 'string', description: 'Search query topic' },
      summary: { type: 'string', description: 'Summary of search results' },
      results: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            snippet: { type: 'string' },
            url: { type: 'string' },
            relevance: { type: 'number' },
          },
          required: ['title', 'snippet'],
        },
        description: 'Search result items',
      },
      relatedQueries: {
        type: 'array',
        items: { type: 'string' },
        description: 'Related search suggestions',
      },
      confidence: { type: 'number', description: 'Confidence score 0-1' },
    },
    required: ['topic', 'summary', 'results'],
  },
}

// =============================================================================
// Task Schema - For action items and to-dos
// =============================================================================
export const taskSchema: ResponseSchema = {
  type: 'task',
  name: 'Task Response',
  description: 'For breaking down tasks into actionable steps',
  schema: {
    type: 'object',
    properties: {
      topic: { type: 'string', description: 'Task description' },
      steps: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            order: { type: 'number' },
            action: { type: 'string' },
            details: { type: 'string' },
            status: { type: 'string', enum: ['pending', 'completed', 'skipped'] },
          },
          required: ['order', 'action'],
        },
        description: 'Task steps',
      },
      estimatedTime: { type: 'string', description: 'Estimated time to complete' },
      prerequisites: {
        type: 'array',
        items: { type: 'string' },
        description: 'Prerequisites before starting',
      },
      confidence: { type: 'number', description: 'Confidence score 0-1' },
    },
    required: ['topic', 'steps'],
  },
}

// =============================================================================
// Creative Schema - For creative writing
// =============================================================================
export const creativeSchema: ResponseSchema = {
  type: 'creative',
  name: 'Creative Response',
  description: 'For creative writing, storytelling, and artistic content',
  schema: {
    type: 'object',
    properties: {
      topic: { type: 'string', description: 'Creative piece topic/title' },
      content: { type: 'string', description: 'The creative content' },
      style: { type: 'string', description: 'Writing style used' },
      variations: {
        type: 'array',
        items: { type: 'string' },
        description: 'Alternative versions or variations',
      },
      confidence: { type: 'number', description: 'Confidence score 0-1' },
    },
    required: ['topic', 'content'],
  },
}

// =============================================================================
// Summary Schema - For summarization
// =============================================================================
export const summarySchema: ResponseSchema = {
  type: 'summary',
  name: 'Summary Response',
  description: 'For summarizing content, documents, or conversations',
  schema: {
    type: 'object',
    properties: {
      topic: { type: 'string', description: 'What is being summarized' },
      summary: { type: 'string', description: 'The summary text' },
      keyPoints: {
        type: 'array',
        items: { type: 'string' },
        description: 'Key points extracted',
      },
      length: { type: 'string', enum: ['brief', 'moderate', 'detailed'] },
      confidence: { type: 'number', description: 'Confidence score 0-1' },
    },
    required: ['topic', 'summary', 'keyPoints'],
  },
}

// =============================================================================
// Comparison Schema - For comparing options
// =============================================================================
export const comparisonSchema: ResponseSchema = {
  type: 'comparison',
  name: 'Comparison Response',
  description: 'For comparing multiple items, options, or concepts',
  schema: {
    type: 'object',
    properties: {
      topic: { type: 'string', description: 'What is being compared' },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            pros: { type: 'array', items: { type: 'string' } },
            cons: { type: 'array', items: { type: 'string' } },
            score: { type: 'number' },
          },
          required: ['name', 'pros', 'cons'],
        },
        description: 'Items being compared',
      },
      winner: { type: 'string', description: 'Recommended option if any' },
      conclusion: { type: 'string', description: 'Final comparison conclusion' },
      confidence: { type: 'number', description: 'Confidence score 0-1' },
    },
    required: ['topic', 'items', 'conclusion'],
  },
}

// =============================================================================
// Instruction Schema - For how-to guides
// =============================================================================
export const instructionSchema: ResponseSchema = {
  type: 'instruction',
  name: 'Instruction Response',
  description: 'For step-by-step instructions and how-to guides',
  schema: {
    type: 'object',
    properties: {
      topic: { type: 'string', description: 'What is being taught' },
      objective: { type: 'string', description: 'What the user will achieve' },
      steps: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            order: { type: 'number' },
            instruction: { type: 'string' },
            note: { type: 'string' },
            code: { type: 'string' },
          },
          required: ['order', 'instruction'],
        },
        description: 'Instruction steps',
      },
      warnings: {
        type: 'array',
        items: { type: 'string' },
        description: 'Important warnings',
      },
      tips: {
        type: 'array',
        items: { type: 'string' },
        description: 'Helpful tips',
      },
      confidence: { type: 'number', description: 'Confidence score 0-1' },
    },
    required: ['topic', 'objective', 'steps'],
  },
}

// =============================================================================
// ReAct Decision Schema - For agent's thinking process
// =============================================================================
export const reactDecisionSchema: ResponseSchema = {
  type: 'conversational' as SchemaType, // Using conversational as base
  name: 'ReAct Decision',
  description: 'For the agent to decide what action to take',
  schema: {
    type: 'object',
    properties: {
      thought: {
        type: 'string',
        description: 'Your reasoning about what to do next',
      },
      shouldAct: {
        type: 'boolean',
        description: 'Whether you need to use a tool',
      },
      action: {
        type: 'object',
        properties: {
          tool: { type: 'string', description: 'Tool name to use' },
          input: { type: 'object', description: 'Tool input parameters' },
          reason: { type: 'string', description: 'Why this tool is needed' },
        },
        description: 'Action to take if shouldAct is true',
      },
      finalAnswer: {
        type: 'string',
        description: 'Final answer if no more actions needed',
      },
      confidence: { type: 'number', description: 'Confidence in decision 0-1' },
    },
    required: ['thought', 'shouldAct'],
  },
}

// =============================================================================
// Query Classification Schema - For understanding user intent
// =============================================================================
export const queryClassificationSchema: ResponseSchema = {
  type: 'conversational' as SchemaType,
  name: 'Query Classification',
  description: 'For classifying user queries to determine the best response type',
  schema: {
    type: 'object',
    properties: {
      intent: {
        type: 'string',
        enum: [
          'question',
          'code_request',
          'explanation',
          'comparison',
          'task',
          'creative',
          'search',
          'summary',
          'instruction',
          'conversation',
        ],
        description: 'Primary intent of the query',
      },
      responseType: {
        type: 'string',
        enum: [
          'conversational',
          'code',
          'analytical',
          'search',
          'task',
          'creative',
          'summary',
          'comparison',
          'instruction',
        ],
        description: 'Best response schema to use',
      },
      requiresTools: {
        type: 'array',
        items: { type: 'string' },
        description: 'Tools that might be needed',
      },
      complexity: {
        type: 'string',
        enum: ['simple', 'moderate', 'complex'],
        description: 'Query complexity',
      },
      keywords: {
        type: 'array',
        items: { type: 'string' },
        description: 'Key terms extracted from query',
      },
    },
    required: ['intent', 'responseType', 'complexity'],
  },
}

// =============================================================================
// Schema Registry
// =============================================================================
export const schemaRegistry: Map<SchemaType, ResponseSchema> = new Map([
  ['conversational', conversationalSchema],
  ['code', codeSchema],
  ['analytical', analyticalSchema],
  ['search', searchSchema],
  ['task', taskSchema],
  ['creative', creativeSchema],
  ['summary', summarySchema],
  ['comparison', comparisonSchema],
  ['instruction', instructionSchema],
])

/**
 * Get schema by type
 */
export function getSchema(type: SchemaType): ResponseSchema {
  return schemaRegistry.get(type) || conversationalSchema
}

/**
 * Get all available schemas
 */
export function getAllSchemas(): ResponseSchema[] {
  return Array.from(schemaRegistry.values())
}

/**
 * Get schema for LLM prompt (stringified)
 */
export function getSchemaForPrompt(type: SchemaType): string {
  const schema = getSchema(type)
  return JSON.stringify(schema.schema, null, 2)
}

/**
 * Get multiple schemas for dynamic response
 */
export function getSchemasForPrompt(types: SchemaType[]): string {
  const schemas = types.map((type) => ({
    type,
    schema: getSchema(type).schema,
  }))
  return JSON.stringify(schemas, null, 2)
}
