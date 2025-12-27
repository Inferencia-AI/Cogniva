// =============================================================================
// Bot Response Flow - Manual control over agent response generation
// =============================================================================

import type {
  AgentContext,
  AgentStep,
  AgentThought,
  AgentAction,
  AgentObservation,
  AgentResponse,
  AgentConfig,
  Flow,
  FlowStep,
  FlowStepResult,
  ConversationMessage,
  ResponseSource,
  ResponseMetadata,
  SchemaType,
} from '../types/agent.js'

import { DEFAULT_AGENT_CONFIG } from '../types/agent.js'
import { invokeLLMStructured, classifyQuery, generateResponse } from '../utils/ollamaEnhanced.js'
import { executeTool, getToolDescriptions, getAllTools } from './tools.js'
import { getSchema, getSchemaForPrompt } from '../schemas/responseSchemas.js'

// =============================================================================
// Flow Controller - Main orchestration class
// =============================================================================

export class BotResponseFlow {
  private config: AgentConfig
  private context: AgentContext
  private abortController: AbortController | null = null

  constructor(config: Partial<AgentConfig> = {}) {
    this.config = { ...DEFAULT_AGENT_CONFIG, ...config }
    this.context = this.createInitialContext()
  }

  // ---------------------------------------------------------------------------
  // Context Management
  // ---------------------------------------------------------------------------

  private createInitialContext(): AgentContext {
    return {
      maxIterations: this.config.maxIterations,
      currentIteration: 0,
      steps: [],
      state: 'idle',
      startTime: Date.now(),
      timeout: this.config.timeout,
      memory: {
        shortTerm: [],
        workingContext: [],
        conversationHistory: [],
      },
    }
  }

  /**
   * Reset the flow to initial state
   */
  reset(): void {
    this.context = this.createInitialContext()
    this.abortController = null
  }

  /**
   * Abort current execution
   */
  abort(): void {
    if (this.abortController) {
      this.abortController.abort()
    }
    this.context.state = 'idle'
  }

  /**
   * Get current context (read-only)
   */
  getContext(): Readonly<AgentContext> {
    return { ...this.context }
  }

  /**
   * Get execution steps for debugging
   */
  getSteps(): readonly AgentStep[] {
    return [...this.context.steps]
  }

  // ---------------------------------------------------------------------------
  // Flow Execution
  // ---------------------------------------------------------------------------

  /**
   * Main entry point - Process a user message through the full flow
   */
  async process(
    userMessage: string,
    conversationHistory: ConversationMessage[] = [],
    options: {
      userId?: string
      sessionId?: string
      forceSchema?: SchemaType
    } = {}
  ): Promise<{
    response: AgentResponse | null
    steps: AgentStep[]
    metadata: ResponseMetadata
    error?: string
  }> {
    this.reset()
    this.abortController = new AbortController()
    this.context.userId = options.userId
    this.context.sessionId = options.sessionId
    this.context.state = 'thinking'
    this.context.memory.conversationHistory = conversationHistory

    const startTime = Date.now()
    const toolsUsed: string[] = []

    try {
      // Step 1: Classify the query
      const classification = await this.classifyQuery(userMessage)
      const schemaType = options.forceSchema || classification.responseType

      // Step 2: Run ReAct loop if tools are needed
      let gatheredContext: string[] = []
      let sources: ResponseSource[] = []

      if (classification.requiresTools && classification.requiresTools.length > 0) {
        const reactResult = await this.runReActLoop(userMessage, classification, options.userId)
        gatheredContext = reactResult.context
        sources = reactResult.sources
        toolsUsed.push(...reactResult.toolsUsed)
      }

      // Step 3: Generate final response
      this.context.state = 'responding'
      const response = await this.generateFinalResponse(
        userMessage,
        schemaType,
        gatheredContext,
        sources
      )

      this.context.state = 'complete'

      return {
        response,
        steps: [...this.context.steps],
        metadata: {
          processingTime: Date.now() - startTime,
          model: this.config.model,
          iterationCount: this.context.currentIteration,
          toolsUsed,
        },
      }
    } catch (error) {
      this.context.state = 'error'
      return {
        response: null,
        steps: [...this.context.steps],
        metadata: {
          processingTime: Date.now() - startTime,
          model: this.config.model,
          iterationCount: this.context.currentIteration,
          toolsUsed,
        },
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Step 1: Query Classification
  // ---------------------------------------------------------------------------

  private async classifyQuery(userMessage: string): Promise<{
    intent: string
    responseType: SchemaType
    requiresTools: string[]
    complexity: string
    keywords: string[]
  }> {
    const classificationPrompt = `Analyze this user query and classify it:

User Query: "${userMessage}"

Available Tools:
${getToolDescriptions()}

Determine:
1. The user's intent
2. Best response type to use
3. Which tools (if any) are needed
4. Query complexity
5. Key terms`

    try {
      const result = await classifyQuery(classificationPrompt)
      
      return {
        intent: result.intent || 'question',
        responseType: (result.responseType as SchemaType) || 'conversational',
        requiresTools: result.requiresTools || [],
        complexity: result.complexity || 'simple',
        keywords: result.keywords || [],
      }
    } catch (error) {
      // Default to conversational if classification fails
      return {
        intent: 'question',
        responseType: 'conversational',
        requiresTools: [],
        complexity: 'simple',
        keywords: [],
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Step 2: ReAct Loop
  // ---------------------------------------------------------------------------

  private async runReActLoop(
    userMessage: string,
    classification: { requiresTools: string[]; keywords: string[] },
    userId?: string
  ): Promise<{
    context: string[]
    sources: ResponseSource[]
    toolsUsed: string[]
  }> {
    const gatheredContext: string[] = []
    const sources: ResponseSource[] = []
    const toolsUsed: string[] = []

    while (this.context.currentIteration < this.config.maxIterations) {
      this.context.currentIteration++
      
      // Check timeout
      if (Date.now() - this.context.startTime > this.config.timeout) {
        break
      }

      // Check abort
      if (this.abortController?.signal.aborted) {
        break
      }

      // Think: Decide what action to take
      this.context.state = 'thinking'
      const thought = await this.think(userMessage, gatheredContext)

      if (!thought.nextAction || thought.nextAction === 'noOp') {
        // No more actions needed
        const step: AgentStep = {
          thought,
          action: null,
          observation: null,
        }
        this.context.steps.push(step)
        break
      }

      // Act: Execute the tool
      this.context.state = 'acting'
      const action = await this.decideAction(userMessage, thought, userId)

      if (!action) {
        const step: AgentStep = { thought, action: null, observation: null }
        this.context.steps.push(step)
        break
      }

      // Observe: Get and process tool results
      this.context.state = 'observing'
      const observation = await this.observe(action)

      // Record step
      const step: AgentStep = { thought, action, observation }
      this.context.steps.push(step)

      // Process observation
      if (observation.result.success) {
        toolsUsed.push(action.tool)
        const contextStr = this.extractContext(action.tool, observation.result.data)
        if (contextStr) {
          gatheredContext.push(contextStr)
        }
        
        const newSources = this.extractSources(action.tool, observation.result.data)
        sources.push(...newSources)
      }

      // Add to working memory
      this.context.memory.workingContext.push(
        `Tool: ${action.tool}, Success: ${observation.result.success}`
      )
    }

    return { context: gatheredContext, sources, toolsUsed }
  }

  // ---------------------------------------------------------------------------
  // Think: Reasoning step
  // ---------------------------------------------------------------------------

  private async think(
    userMessage: string,
    gatheredContext: string[]
  ): Promise<AgentThought> {
    const contextSummary = gatheredContext.length > 0
      ? `\nAlready gathered context:\n${gatheredContext.join('\n---\n')}`
      : ''

    const prompt = `You are an AI assistant deciding what to do next.

User Question: "${userMessage}"

Available Tools:
${getToolDescriptions()}

Previous Steps: ${this.context.steps.length}
${contextSummary}

Think about:
1. What information do you already have?
2. What information do you still need?
3. Which tool (if any) should you use next?
4. Are you confident enough to answer?

Respond with your reasoning, confidence (0-1), and the next action to take (tool name or null if ready to answer).`

    try {
      const result = await invokeLLMStructured<{
        reasoning?: string
        confidence?: number
        nextAction?: string | null
      }>(
        [{ role: 'human', content: prompt }],
        {
          type: 'object',
          properties: {
            reasoning: { type: 'string' },
            confidence: { type: 'number' },
            nextAction: { type: 'string' },
          },
          required: ['reasoning'],
        }
      )

      return {
        reasoning: typeof result.reasoning === 'string' ? result.reasoning : 'Processing query',
        confidence: Math.min(1, Math.max(0, typeof result.confidence === 'number' ? result.confidence : 0.5)),
        nextAction: typeof result.nextAction === 'string' ? result.nextAction : null,
      }
    } catch (error) {
      return {
        reasoning: 'Error during reasoning, proceeding with available information',
        confidence: 0.3,
        nextAction: null,
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Act: Decide action parameters
  // ---------------------------------------------------------------------------

  private async decideAction(
    userMessage: string,
    thought: AgentThought,
    userId?: string
  ): Promise<AgentAction | null> {
    if (!thought.nextAction) return null

    const tool = getAllTools().find(t => t.name === thought.nextAction)
    if (!tool) return null

    // Build tool input based on tool requirements
    const toolInput: Record<string, unknown> = {}

    // Common parameters
    if ('userId' in tool.parameters && userId) {
      toolInput.userId = userId
    }
    if ('query' in tool.parameters) {
      toolInput.query = userMessage
    }

    // For specific tools, extract relevant parameters
    if (thought.nextAction === 'webSearch') {
      toolInput.query = userMessage
      toolInput.includeImages = true
    } else if (thought.nextAction === 'calculate') {
      // Extract math expression from query
      const mathMatch = userMessage.match(/[\d+\-*/().%\s]+[\d+\-*/().%\s]*/g)
      toolInput.expression = mathMatch ? mathMatch.join('') : userMessage
    }

    return {
      tool: thought.nextAction,
      toolInput,
      reasoning: thought.reasoning,
    }
  }

  // ---------------------------------------------------------------------------
  // Observe: Execute tool and observe results
  // ---------------------------------------------------------------------------

  private async observe(action: AgentAction): Promise<AgentObservation> {
    const result = await executeTool(action.tool, action.toolInput)

    return {
      tool: action.tool,
      result,
      timestamp: Date.now(),
    }
  }

  // ---------------------------------------------------------------------------
  // Extract context from tool results
  // ---------------------------------------------------------------------------

  private extractContext(toolName: string, data: unknown): string | null {
    if (!data) return null

    switch (toolName) {
      case 'searchNotes': {
        const noteData = data as { notes: Array<{ title: string; body: string }> }
        if (!noteData.notes?.length) return null
        return noteData.notes
          .map((n) => `Note: ${n.title}\n${n.body?.slice(0, 1000) || ''}`)
          .join('\n---\n')
      }

      case 'searchCorpus': {
        const corpusData = data as { corpus: Array<{ title: string; body: string; knowledgebaseName: string }> }
        if (!corpusData.corpus?.length) return null
        return corpusData.corpus
          .map((c) => `Knowledge (${c.knowledgebaseName}): ${c.title}\n${c.body?.slice(0, 1000) || ''}`)
          .join('\n---\n')
      }

      case 'webSearch': {
        const webData = data as { answer: string; links: string[] }
        if (!webData.answer) return null
        return `Web Search Result:\n${webData.answer}`
      }

      case 'calculate': {
        const calcData = data as { expression: string; result: number }
        return `Calculation: ${calcData.expression} = ${calcData.result}`
      }

      case 'getCurrentTime': {
        const timeData = data as { formatted: string }
        return `Current Time: ${timeData.formatted}`
      }

      default:
        return JSON.stringify(data)
    }
  }

  // ---------------------------------------------------------------------------
  // Extract sources from tool results
  // ---------------------------------------------------------------------------

  private extractSources(toolName: string, data: unknown): ResponseSource[] {
    if (!data) return []

    switch (toolName) {
      case 'searchNotes': {
        const noteData = data as { notes: Array<{ noteId: number; title: string; body: string; similarity: number }> }
        return (noteData.notes || []).map((n) => ({
          type: 'note' as const,
          title: n.title,
          noteId: n.noteId,
          snippet: n.body?.slice(0, 150) || '',
          relevance: n.similarity,
        }))
      }

      case 'searchCorpus': {
        const corpusData = data as { corpus: Array<{ corpusId: number; title: string; body: string; knowledgebaseName: string; similarity: number }> }
        return (corpusData.corpus || []).map((c) => ({
          type: 'corpus' as const,
          title: c.title,
          corpusId: c.corpusId,
          snippet: c.body?.slice(0, 150) || '',
          relevance: c.similarity,
        }))
      }

      case 'webSearch': {
        const webData = data as { links: string[] }
        return (webData.links || []).slice(0, 5).map((url) => ({
          type: 'web' as const,
          title: url,
          url,
        }))
      }

      default:
        return []
    }
  }

  // ---------------------------------------------------------------------------
  // Step 3: Generate Final Response
  // ---------------------------------------------------------------------------

  private async generateFinalResponse(
    userMessage: string,
    schemaType: SchemaType,
    gatheredContext: string[],
    sources: ResponseSource[]
  ): Promise<AgentResponse> {
    const schema = getSchema(schemaType)
    const contextSection = gatheredContext.length > 0
      ? `\n\nContext (use this information to answer):\n${gatheredContext.join('\n\n---\n\n')}`
      : ''

    const prompt = `You are a helpful AI assistant. Answer the user's question using the provided context if available.

User Question: "${userMessage}"
${contextSection}

Respond using this schema:
${getSchemaForPrompt(schemaType)}

Important:
- Be concise and accurate
- Use the context when available
- Cite sources when applicable
- Set confidence based on how sure you are`

    try {
      const result = await generateResponse(
        [{ role: 'human', content: prompt }],
        schemaType
      )

      // Ensure response has required fields
      return {
        type: schemaType,
        topic: result.topic || 'Response',
        confidence: result.confidence || 0.8,
        sources: sources.length > 0 ? sources : undefined,
        ...result,
      } as AgentResponse
    } catch (error) {
      // Return fallback response
      return {
        type: 'conversational',
        topic: 'Error',
        response: 'I apologize, but I encountered an error while processing your request. Please try again.',
        confidence: 0,
      }
    }
  }
}

// =============================================================================
// Flow Presets - Pre-configured flows for common use cases
// =============================================================================

/**
 * Create a simple chat flow (no tools, just LLM response)
 */
export function createSimpleChatFlow(): BotResponseFlow {
  return new BotResponseFlow({
    maxIterations: 1,
    enabledTools: [],
    defaultSchema: 'conversational',
  })
}

/**
 * Create a RAG flow (searches notes and corpus first)
 */
export function createRAGFlow(): BotResponseFlow {
  return new BotResponseFlow({
    maxIterations: 3,
    enabledTools: ['searchNotes', 'searchCorpus'],
    defaultSchema: 'conversational',
  })
}

/**
 * Create a full agent flow (all tools enabled)
 */
export function createAgentFlow(): BotResponseFlow {
  return new BotResponseFlow({
    maxIterations: 5,
    enabledTools: ['searchNotes', 'searchCorpus', 'webSearch', 'calculate', 'getCurrentTime'],
    defaultSchema: 'conversational',
  })
}

/**
 * Create a code assistant flow
 */
export function createCodeAssistantFlow(): BotResponseFlow {
  return new BotResponseFlow({
    maxIterations: 3,
    enabledTools: ['searchNotes', 'searchCorpus'],
    defaultSchema: 'code',
  })
}

/**
 * Create a research flow (heavy on web search)
 */
export function createResearchFlow(): BotResponseFlow {
  return new BotResponseFlow({
    maxIterations: 5,
    enabledTools: ['webSearch', 'searchCorpus', 'summarizeContent'],
    defaultSchema: 'analytical',
  })
}

// =============================================================================
// Singleton instance for simple usage
// =============================================================================

let defaultFlow: BotResponseFlow | null = null

/**
 * Get or create the default flow instance
 */
export function getDefaultFlow(): BotResponseFlow {
  if (!defaultFlow) {
    defaultFlow = new BotResponseFlow()
  }
  return defaultFlow
}

/**
 * Process a message using the default flow
 */
export async function processMessage(
  userMessage: string,
  options: {
    userId?: string
    sessionId?: string
    conversationHistory?: ConversationMessage[]
    forceSchema?: SchemaType
    config?: Partial<AgentConfig>
  } = {}
): Promise<{
  response: AgentResponse | null
  steps: AgentStep[]
  metadata: ResponseMetadata
  error?: string
}> {
  const flow = options.config ? new BotResponseFlow(options.config) : getDefaultFlow()
  
  return flow.process(
    userMessage,
    options.conversationHistory || [],
    {
      userId: options.userId,
      sessionId: options.sessionId,
      forceSchema: options.forceSchema,
    }
  )
}

// =============================================================================
// Export
// =============================================================================

export default BotResponseFlow
