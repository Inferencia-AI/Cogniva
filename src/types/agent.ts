// =============================================================================
// Agent Types - Core types for ReAct agent pattern
// =============================================================================

/**
 * Agent thought represents the reasoning step in ReAct pattern
 */
export interface AgentThought {
  reasoning: string
  confidence: number // 0-1 scale
  nextAction: string | null
}

/**
 * Tool definition for the agent
 */
export interface Tool {
  name: string
  description: string
  parameters: Record<string, ToolParameter>
  required: string[]
  execute: (params: Record<string, unknown>) => Promise<ToolResult>
}

export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  description: string
  enum?: string[]
  items?: { type: string }
  default?: unknown
}

/**
 * Result from tool execution
 */
export interface ToolResult {
  success: boolean
  data: unknown
  error?: string
  metadata?: Record<string, unknown>
}

/**
 * Action to be taken by the agent
 */
export interface AgentAction {
  tool: string
  toolInput: Record<string, unknown>
  reasoning: string
}

/**
 * Observation from tool execution
 */
export interface AgentObservation {
  tool: string
  result: ToolResult
  timestamp: number
}

/**
 * Complete agent step (Thought -> Action -> Observation)
 */
export interface AgentStep {
  thought: AgentThought
  action: AgentAction | null
  observation: AgentObservation | null
}

/**
 * Agent execution state
 */
export type AgentState = 
  | 'idle'
  | 'thinking'
  | 'acting'
  | 'observing'
  | 'responding'
  | 'error'
  | 'complete'

/**
 * Agent execution context
 */
export interface AgentContext {
  userId?: string
  sessionId?: string
  maxIterations: number
  currentIteration: number
  steps: AgentStep[]
  state: AgentState
  startTime: number
  timeout: number
  memory: AgentMemory
}

/**
 * Short-term and long-term memory for the agent
 */
export interface AgentMemory {
  shortTerm: MemoryItem[]
  workingContext: string[]
  conversationHistory: ConversationMessage[]
}

export interface MemoryItem {
  content: string
  type: 'fact' | 'observation' | 'preference' | 'context'
  timestamp: number
  relevance: number
}

export interface ConversationMessage {
  role: 'human' | 'ai' | 'system' | 'tool'
  content: string
  timestamp: number
}

// =============================================================================
// Schema Types - For structured LLM outputs
// =============================================================================

/**
 * Schema type identifier
 */
export type SchemaType = 
  | 'conversational'
  | 'code'
  | 'analytical'
  | 'search'
  | 'task'
  | 'creative'
  | 'summary'
  | 'comparison'
  | 'instruction'

/**
 * Response schema definition
 */
export interface ResponseSchema {
  type: SchemaType
  name: string
  description: string
  schema: Record<string, unknown>
  examples?: unknown[]
}

// =============================================================================
// Agent Response Types
// =============================================================================

/**
 * Base response structure
 */
export interface BaseResponse {
  type: SchemaType
  topic: string
  confidence: number
  sources?: ResponseSource[]
  metadata?: ResponseMetadata
}

/**
 * Conversational response
 */
export interface ConversationalResponse extends BaseResponse {
  type: 'conversational'
  response: string
  followUp?: string[]
}

/**
 * Code response
 */
export interface CodeResponse extends BaseResponse {
  type: 'code'
  response: CodeBlock[]
  explanation?: string
}

export interface CodeBlock {
  language: string
  code: string
  filename?: string
  description?: string
}

/**
 * Analytical response
 */
export interface AnalyticalResponse extends BaseResponse {
  type: 'analytical'
  analysis: string
  insights: string[]
  data?: Record<string, unknown>
  visualization?: VisualizationHint
}

export interface VisualizationHint {
  type: 'chart' | 'table' | 'graph' | 'timeline'
  config: Record<string, unknown>
}

/**
 * Search response
 */
export interface SearchResponse extends BaseResponse {
  type: 'search'
  summary: string
  results: SearchResultItem[]
  relatedQueries?: string[]
}

export interface SearchResultItem {
  title: string
  snippet: string
  url?: string
  relevance: number
}

/**
 * Task response
 */
export interface TaskResponse extends BaseResponse {
  type: 'task'
  steps: TaskStep[]
  estimatedTime?: string
  prerequisites?: string[]
}

export interface TaskStep {
  order: number
  action: string
  details?: string
  status: 'pending' | 'completed' | 'skipped'
}

/**
 * Creative response
 */
export interface CreativeResponse extends BaseResponse {
  type: 'creative'
  content: string
  style?: string
  variations?: string[]
}

/**
 * Summary response
 */
export interface SummaryResponse extends BaseResponse {
  type: 'summary'
  summary: string
  keyPoints: string[]
  length: 'brief' | 'moderate' | 'detailed'
}

/**
 * Comparison response
 */
export interface ComparisonResponse extends BaseResponse {
  type: 'comparison'
  items: ComparisonItem[]
  winner?: string
  conclusion: string
}

export interface ComparisonItem {
  name: string
  pros: string[]
  cons: string[]
  score?: number
}

/**
 * Instruction response
 */
export interface InstructionResponse extends BaseResponse {
  type: 'instruction'
  objective: string
  steps: InstructionStep[]
  warnings?: string[]
  tips?: string[]
}

export interface InstructionStep {
  order: number
  instruction: string
  note?: string
  code?: string
}

/**
 * Union type for all response types
 */
export type AgentResponse = 
  | ConversationalResponse
  | CodeResponse
  | AnalyticalResponse
  | SearchResponse
  | TaskResponse
  | CreativeResponse
  | SummaryResponse
  | ComparisonResponse
  | InstructionResponse

/**
 * Response source
 */
export interface ResponseSource {
  type: 'note' | 'corpus' | 'web' | 'tool'
  title: string
  url?: string
  noteId?: number
  corpusId?: number
  snippet?: string
  relevance?: number
}

/**
 * Response metadata
 */
export interface ResponseMetadata {
  processingTime: number
  tokensUsed?: number
  model: string
  iterationCount: number
  toolsUsed: string[]
}

// =============================================================================
// Agent Configuration
// =============================================================================

export interface AgentConfig {
  maxIterations: number
  timeout: number
  temperature: number
  model: string
  enabledTools: string[]
  defaultSchema: SchemaType
  streamResponses: boolean
  retryAttempts: number
  retryDelay: number
}

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  maxIterations: 5,
  timeout: 60000, // 60 seconds
  temperature: 0.7,
  model: 'gpt-oss:20b-cloud',
  enabledTools: ['searchNotes', 'searchCorpus', 'webSearch', 'calculate'],
  defaultSchema: 'conversational',
  streamResponses: false,
  retryAttempts: 3,
  retryDelay: 1000,
}

// =============================================================================
// Flow Control Types
// =============================================================================

export interface FlowStep {
  id: string
  name: string
  type: 'classify' | 'retrieve' | 'think' | 'act' | 'respond' | 'validate'
  condition?: (context: AgentContext) => boolean
  execute: (context: AgentContext, input: unknown) => Promise<FlowStepResult>
  next?: string | ((result: FlowStepResult) => string)
}

export interface FlowStepResult {
  success: boolean
  data: unknown
  nextStep?: string
  shouldContinue: boolean
}

export interface Flow {
  name: string
  description: string
  steps: Map<string, FlowStep>
  entryPoint: string
}

// =============================================================================
// Request/Response Types for API
// =============================================================================

export interface AgentRequest {
  messages: ConversationMessage[]
  userId?: string
  sessionId?: string
  config?: Partial<AgentConfig>
  forceSchema?: SchemaType
  context?: Record<string, unknown>
}

export interface AgentApiResponse {
  success: boolean
  response: AgentResponse | null
  steps: AgentStep[]
  metadata: ResponseMetadata
  error?: string
}
