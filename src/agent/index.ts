// =============================================================================
// Agent Module - Export all agent-related functionality
// =============================================================================

// Core types
export type {
  Tool,
  ToolParameter,
  ToolResult,
  AgentThought,
  AgentAction,
  AgentObservation,
  AgentStep,
  AgentState,
  AgentContext,
  AgentMemory,
  MemoryItem,
  ConversationMessage,
  SchemaType,
  ResponseSchema,
  BaseResponse,
  ConversationalResponse,
  CodeResponse,
  AnalyticalResponse,
  SearchResponse,
  TaskResponse,
  CreativeResponse,
  SummaryResponse,
  ComparisonResponse,
  InstructionResponse,
  AgentResponse,
  ResponseSource,
  ResponseMetadata,
  AgentConfig,
  FlowStep,
  FlowStepResult,
  Flow,
  AgentRequest,
  AgentApiResponse,
} from '../types/agent.js'

export { DEFAULT_AGENT_CONFIG } from '../types/agent.js'

// Tools
export {
  registerTool,
  getTool,
  getAllTools,
  getToolDescriptions,
  getToolSchema,
  executeTool,
} from './tools.js'

// Schemas
export {
  conversationalSchema,
  codeSchema,
  analyticalSchema,
  searchSchema,
  taskSchema,
  creativeSchema,
  summarySchema,
  comparisonSchema,
  instructionSchema,
  schemaRegistry,
  getSchema,
  getAllSchemas,
  getSchemaForPrompt,
  getSchemasForPrompt,
} from '../schemas/responseSchemas.js'

// Bot Response Flow
export {
  BotResponseFlow,
  createSimpleChatFlow,
  createRAGFlow,
  createAgentFlow,
  createCodeAssistantFlow,
  createResearchFlow,
  getDefaultFlow,
  processMessage,
} from './bot_response_flow.js'

// LLM utilities
export {
  invokeLLM,
  invokeLLMStructured,
  classifyQuery,
  generateResponse,
  generateMultiSchemaResponse,
  chat,
  summarize,
  extract,
  streamLLM,
  getLLM,
  extractJsonSafe,
  DEFAULT_CONFIG as DEFAULT_LLM_CONFIG,
} from '../utils/ollamaEnhanced.js'
