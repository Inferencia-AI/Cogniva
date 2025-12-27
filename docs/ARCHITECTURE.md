# Cogniva Backend - Comprehensive Architecture Guide

A complete guide to building a modern AI-powered knowledge management and chat system using Hono.js, LangChain, PostgreSQL (Neon), and the ReAct agent pattern.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Technology Stack](#technology-stack)
3. [Architecture Overview](#architecture-overview)
4. [Directory Structure](#directory-structure)
5. [Core Components](#core-components)
   - [Entry Point (index.ts)](#entry-point)
   - [Routes](#routes)
   - [Agent System](#agent-system)
   - [Utilities](#utilities)
6. [Database Design](#database-design)
7. [AI & LLM Integration](#ai--llm-integration)
8. [Authentication & Security](#authentication--security)
9. [Prompt Moderation](#prompt-moderation)
10. [Building from Scratch](#building-from-scratch)
11. [API Reference](#api-reference)
12. [Best Practices](#best-practices)

---

## Project Overview

Cogniva is an AI-powered knowledge management system that combines:

- **Personal Notes Management**: Users can create, edit, and search personal notes
- **Knowledge Bases (Corpus)**: Shared knowledge repositories with approval workflows
- **AI Chat Assistant**: An intelligent chat system using the ReAct agent pattern
- **Semantic Search**: Vector-based semantic search using `query-sense`
- **Web Search Integration**: Real-time web search with Tavily API
- **Content Moderation**: Built-in prompt safety checks

### Key Features

- 🤖 **ReAct Agent Pattern**: Reason + Act loop for intelligent responses
- 📚 **RAG (Retrieval Augmented Generation)**: Enhances AI responses with user's knowledge
- 🔍 **Semantic Search**: Natural language search across notes and knowledge bases
- 🛡️ **Content Moderation**: Automatic detection of harmful prompts
- 📄 **Document Parsing**: Upload and convert PDF, DOCX, RTF, MD to notes
- 🌐 **Multi-source Search**: Combine notes, corpus, and web results

---

## Technology Stack

| Category | Technology | Purpose |
|----------|------------|---------|
| **Runtime** | Node.js | JavaScript runtime |
| **Framework** | Hono.js | Lightweight web framework |
| **Database** | Neon (PostgreSQL) | Serverless PostgreSQL |
| **AI/LLM** | LangChain + Ollama | LLM orchestration |
| **Auth** | Firebase Admin SDK | Token validation |
| **Search** | query-sense | Semantic search |
| **Web Search** | Tavily API | Real-time web search |
| **Document Parsing** | mammoth, unpdf, marked | Document conversion |
| **Cloud Storage** | Vercel Blob | Image storage |

### Package Dependencies

```json
{
  "dependencies": {
    "hono": "^4.x",
    "@hono/node-server": "^1.x",
    "@langchain/ollama": "^0.x",
    "@langchain/core": "^0.x",
    "@neondatabase/serverless": "^0.x",
    "firebase-admin": "^12.x",
    "query-sense": "^1.x",
    "@tavily/core": "^0.x",
    "mammoth": "^1.x",
    "unpdf": "^0.x",
    "marked": "^15.x",
    "axios": "^1.x"
  }
}
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React)                         │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                         Hono.js Server                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   CORS      │  │    Auth     │  │   Prompt Moderation     │  │
│  │ Middleware  │  │ Middleware  │  │      Middleware         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        ▼                         ▼                         ▼
┌───────────────┐       ┌───────────────┐       ┌───────────────┐
│  Chat Routes  │       │ Agent Routes  │       │ Notes Routes  │
│  /chat/*      │       │ /agent/*      │       │ /notes/*      │
└───────────────┘       └───────────────┘       └───────────────┘
        │                       │                       │
        └───────────────────────┼───────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Agent System (ReAct Pattern)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │   Classify   │  │    Tools     │  │   Response Schemas   │   │
│  │    Query     │──▶│  Execution   │──▶│    (Structured)      │   │
│  └──────────────┘  └──────────────┘  └──────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
┌───────────────┐       ┌───────────────┐       ┌───────────────┐
│   LLM Utils   │       │  Neon (DB)    │       │  External     │
│  (Ollama)     │       │  PostgreSQL   │       │  Services     │
└───────────────┘       └───────────────┘       └───────────────┘
                                                        │
                                        ┌───────────────┼───────────────┐
                                        ▼               ▼               ▼
                                ┌────────────┐  ┌────────────┐  ┌────────────┐
                                │   Tavily   │  │  Firebase  │  │   Vercel   │
                                │   Search   │  │   Admin    │  │    Blob    │
                                └────────────┘  └────────────┘  └────────────┘
```

---

## Directory Structure

```
cogniva-backend/
├── src/
│   ├── index.ts                    # Entry point, route registration
│   ├── agent/                      # ReAct Agent system
│   │   ├── index.ts                # Agent module exports
│   │   ├── bot_response_flow.ts    # Main flow controller
│   │   └── tools.ts                # Tool definitions
│   ├── functions/                  # Reusable functions
│   │   ├── search.ts               # Tavily search wrapper
│   │   ├── scrapUrl.ts             # Web scraping
│   │   └── scrapDaraz.ts           # E-commerce scraping
│   ├── middlewares/
│   │   └── auth.middleware.ts      # Firebase auth middleware
│   ├── routes/
│   │   ├── agent.ts                # Agent API endpoints
│   │   ├── chat.ts                 # Chat endpoints
│   │   ├── corpus.ts               # Corpus management
│   │   ├── knowledgebase.ts        # Knowledgebase management
│   │   ├── notes.ts                # Notes CRUD
│   │   ├── webSearch.ts            # Web search endpoints
│   │   └── content.ts              # Content processing
│   ├── schemas/
│   │   └── responseSchemas.ts      # LLM response schemas
│   ├── types/
│   │   └── agent.ts                # TypeScript type definitions
│   └── utils/
│       ├── ollamaEnhanced.ts       # LLM integration
│       ├── (prompt moderation removed)      # Content moderation was disabled
│       ├── noteSearch.ts           # Semantic note search
│       ├── documentParser.ts       # Document conversion
│       ├── firebase.ts             # Firebase Admin SDK
│       ├── neon.ts                 # Database connection
│       ├── tavily.ts               # Tavily client
│       └── vercelCloud.ts          # Cloud storage
├── package.json
├── tsconfig.json
└── cogniva-configs.json
```

---

## Core Components

### Entry Point

The application entry point (`src/index.ts`) sets up:

1. **CORS Configuration**: Allows cross-origin requests from frontend
2. **Route Registration**: Mounts all route handlers
3. **Legacy Routes**: Backward compatibility redirects
4. **Server Startup**: Hono server on port 3000

```typescript
// Core structure
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'

const app = new Hono()

// CORS middleware
app.use('/*', cors({
  origin: ['https://cogniva.pages.dev'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

// Mount routes
app.route('/knowledgebase', knowledgebaseRoutes)
app.route('/corpus', corpusRoutes)
app.route('/notes', notesRoutes)
app.route('/chat', chatRoutes)
app.route('/agent', agentRoutes)
app.route('/web-search', webSearchRoutes)
app.route('/content', contentRoutes)

// Start server
serve({ fetch: app.fetch, port: 3000 })
```

### Routes

#### Agent Routes (`/agent/*`)

The agent routes implement the ReAct (Reason + Act) pattern for intelligent responses:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/agent/chat` | POST | Full agent chat with tool use |
| `/agent/quick` | POST | Quick response without ReAct loop |
| `/agent/classify` | POST | Classify query intent |
| `/agent/code` | POST | Code-specific responses |
| `/agent/search` | POST | Search-focused responses |
| `/agent/analyze` | POST | Analytical responses |
| `/agent/compare` | POST | Comparison responses |
| `/agent/task` | POST | Task breakdown |
| `/agent/summarize` | POST | Content summarization |

#### Chat Routes (`/chat/*`)

Simpler chat endpoints for direct LLM interaction:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/chat` | POST | Send message, get AI response |
| `/chat/smart` | POST | Auto-schema selection |
| `/chat/rag` | POST | RAG-enhanced chat |
| `/chat/search-notes` | POST | Search user notes |
| `/chat/history/:uid` | GET | Get chat history |
| `/chat/save` | POST | Save chat session |

#### Notes Routes (`/notes/*`)

CRUD operations for personal notes:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/notes/:uid` | GET | Get all user notes |
| `/notes` | POST | Create new note |
| `/notes/:id` | PUT | Update note |
| `/notes/:id` | DELETE | Delete note |
| `/notes/upload-document` | POST | Upload and convert document |

### Agent System

The agent system is the heart of the AI functionality, implementing the ReAct pattern.

#### ReAct Pattern Flow

```
┌──────────────────────────────────────────────────────────────┐
│                    User Query                                 │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│  1. CLASSIFY: Determine intent and response type             │
│     - intent: question, code_request, search, etc.           │
│     - responseType: conversational, code, analytical, etc.   │
│     - requiresTools: ['searchNotes', 'webSearch', ...]       │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│  2. ReAct LOOP (if tools needed):                            │
│     ┌─────────────────────────────────────────────────────┐  │
│     │  THINK: Reason about what to do next                │  │
│     │    - What info do we have?                          │  │
│     │    - What info do we need?                          │  │
│     │    - Which tool should we use?                      │  │
│     └─────────────────────────────────────────────────────┘  │
│                         │                                    │
│                         ▼                                    │
│     ┌─────────────────────────────────────────────────────┐  │
│     │  ACT: Execute the chosen tool                       │  │
│     │    - searchNotes, searchCorpus, webSearch, etc.     │  │
│     └─────────────────────────────────────────────────────┘  │
│                         │                                    │
│                         ▼                                    │
│     ┌─────────────────────────────────────────────────────┐  │
│     │  OBSERVE: Process tool results                      │  │
│     │    - Extract context from results                   │  │
│     │    - Extract sources for citations                  │  │
│     └─────────────────────────────────────────────────────┘  │
│                         │                                    │
│                         ▼                                    │
│              (Loop until confident or max iterations)        │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│  3. GENERATE: Create final response with gathered context    │
│     - Use appropriate schema for response type               │
│     - Include sources and citations                          │
│     - Apply confidence scoring                               │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                    Structured Response                        │
│    { type, topic, response, confidence, sources, ... }       │
└──────────────────────────────────────────────────────────────┘
```

#### BotResponseFlow Class

The main orchestration class for the agent:

```typescript
export class BotResponseFlow {
  // Configuration
  private config: AgentConfig
  private context: AgentContext
  
  constructor(config: Partial<AgentConfig> = {}) {
    this.config = { ...DEFAULT_AGENT_CONFIG, ...config }
  }
  
  // Main entry point
  async process(
    userMessage: string,
    conversationHistory: ConversationMessage[],
    options: { userId?, sessionId?, forceSchema? }
  ): Promise<{
    response: AgentResponse | null
    steps: AgentStep[]
    metadata: ResponseMetadata
    error?: string
  }>
  
  // Internal methods
  private async classifyQuery(userMessage: string)
  private async runReActLoop(userMessage, classification, userId)
  private async think(userMessage, gatheredContext)
  private async decideAction(userMessage, thought, userId)
  private async observe(action)
  private extractContext(toolName, data)
  private extractSources(toolName, data)
  private async generateFinalResponse(message, schema, context, sources)
}
```

#### Available Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `searchNotes` | Search user's personal notes | userId, query, topK, threshold |
| `searchCorpus` | Search knowledge base articles | userId, query, topK |
| `webSearch` | Search the web via Tavily | query, includeImages |
| `calculate` | Perform math calculations | expression |
| `getCurrentTime` | Get current date/time | timezone, format |
| `summarizeContent` | Summarize long content | content, maxLength, style |
| `noOp` | No tool needed | reason |

#### Response Schemas

The system uses structured schemas for different response types:

```typescript
// Available schema types
type SchemaType = 
  | 'conversational'  // General dialogue
  | 'code'            // Code snippets and explanations
  | 'analytical'      // Data analysis and insights
  | 'search'          // Search results
  | 'task'            // Task breakdowns
  | 'creative'        // Creative writing
  | 'summary'         // Summarizations
  | 'comparison'      // Comparisons
  | 'instruction'     // Step-by-step instructions

// Example: Code Response Schema
const codeSchema = {
  type: 'object',
  properties: {
    topic: { type: 'string' },
    explanation: { type: 'string' },
    response: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          language: { type: 'string' },
          code: { type: 'string' },
          filename: { type: 'string' },
          description: { type: 'string' },
        },
      },
    },
    confidence: { type: 'number' },
  },
  required: ['topic', 'response'],
}
```

### Utilities

#### LLM Integration (ollamaEnhanced.ts)

The unified LLM utility provides:

```typescript
// Core functions
export async function invokeLLM(
  messages: ChatMessage[],
  schema: object = { response: "string" },
  config: Partial<LLMConfig> = {}
): Promise<unknown[]>

export async function invokeLLMStructured<T>(
  messages: ChatMessage[],
  schema: { type, properties, required },
  config?: Partial<LLMConfig>
): Promise<T>

export async function classifyQuery(query: string): Promise<{
  intent: string
  responseType: SchemaType
  requiresTools: string[]
  complexity: string
  keywords: string[]
}>

export async function generateResponse(
  messages: ChatMessage[],
  schemaType: SchemaType,
  config?: Partial<LLMConfig>
): Promise<Record<string, unknown>>

// Convenience functions
export async function chat(prompt: string, systemPrompt?: string): Promise<string>
export async function summarize(content: string, options?): Promise<string>
export async function extract(content: string, fields: string[]): Promise<Record<string, string>>
```

#### Semantic Search (noteSearch.ts)

```typescript
import { semanticSearch } from 'query-sense'

export async function searchUserNotes(
  userId: string,
  query: string,
  options: { topK?: number; threshold?: number } = {}
): Promise<NoteSearchResult[]> {
  // Fetch notes from database
  const notes = await sql`SELECT * FROM notes WHERE user_id = ${userId}`
  
  // Prepare content for semantic search
  const noteContents = notes.map(note => 
    `${note.title}\n${note.body || ''}`
  )
  
  // Perform semantic search
  const searchResponse = await semanticSearch(query, noteContents, {
    topK: options.topK || 3,
    threshold: options.threshold || 0.5,
  })
  
  // Map results back to notes
  return searchResponse.results.map(result => ({
    note: notes[noteContents.indexOf(result.document)],
    similarity: result.score,
    matchedContent: result.document,
  }))
}
```

---

## Database Design

### Tables Overview

```sql
-- Users Notes
CREATE TABLE notes (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Knowledge Bases
CREATE TABLE knowledgebase (
  id SERIAL PRIMARY KEY,
  banner_url TEXT,
  image_url TEXT,
  name TEXT NOT NULL,
  description TEXT,
  notes_ids TEXT[] DEFAULT ARRAY[]::TEXT[],
  managers JSONB[] DEFAULT ARRAY[]::JSONB[],
  subscribers_ids TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Corpus (Knowledge Articles)
CREATE TABLE corpus (
  id SERIAL PRIMARY KEY,
  title TEXT,
  body TEXT,
  keywords TEXT[] DEFAULT ARRAY[]::TEXT[],
  knowledgebase_id INTEGER REFERENCES knowledgebase(id),
  liked_users_ids TEXT[] DEFAULT ARRAY[]::TEXT[],
  comments JSONB[] DEFAULT ARRAY[]::JSONB[],
  is_approved BOOLEAN DEFAULT FALSE
);

-- Chat History
CREATE TABLE chats (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  messages JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Manager Role Structure

```json
{
  "userId": "firebase-uid",
  "role": "admin" | "editor" | "viewer" | "approver"
}
```

### Comment Structure

```json
{
  "user_id": "firebase-uid",
  "comment_text": "Comment content",
  "created_at": "2024-12-27T12:00:00Z"
}
```

---

## AI & LLM Integration

### Configuration

```typescript
interface LLMConfig {
  model: string          // e.g., "gpt-oss:20b-cloud"
  baseUrl: string        // Ollama API endpoint
  temperature: number    // 0-1, controls randomness
  maxRetries: number     // Retry attempts on failure
  retryDelay: number     // Delay between retries (ms)
  timeout: number        // Request timeout (ms)
}

const DEFAULT_CONFIG: LLMConfig = {
  model: process.env.OLLAMA_MODEL || "gpt-oss:20b-cloud",
  baseUrl: process.env.OLLAMA_BASE_URL || "https://ollama.com",
  temperature: 0.7,
  maxRetries: 3,
  retryDelay: 1000,
  timeout: 60000,
}
```

### JSON Extraction

The system uses multiple strategies to extract JSON from LLM responses:

1. **Direct Parse**: Try `JSON.parse()` directly
2. **Code Blocks**: Extract from ```json ... ``` blocks
3. **Object Pattern**: Match `{ ... }` patterns
4. **Array Pattern**: Match `[ ... ]` patterns
5. **Library Fallback**: Use `extract-json-from-string`

```typescript
function extractJsonSafe(text: string): unknown | null {
  // Strategy 1: Direct parse
  try { return JSON.parse(text) } catch {}
  
  // Strategy 2: Code block extraction
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch) {
    try { return JSON.parse(codeBlockMatch[1].trim()) } catch {}
  }
  
  // Strategy 3: Object pattern
  const objectMatch = text.match(/\{[\s\S]*\}/)
  if (objectMatch) {
    try { return JSON.parse(objectMatch[0]) } catch {}
  }
  
  // ... more strategies
}
```

---

## Authentication & Security

### Firebase Token Validation

```typescript
import admin from "../utils/firebase.js"

export async function authMiddleware(c, next) {
  const authHeader = c.req.header("Authorization")
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401)
  }

  const idToken = authHeader.split("Bearer ")[1]

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken)
    c.set("user", decodedToken)
    return next()
  } catch (err) {
    return c.json({ error: "Invalid token" }, 401)
  }
}
```

### Environment Variables

```bash
# Firebase
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY_ID=key-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@project.iam.gserviceaccount.com
FIREBASE_CLIENT_ID=client-id
FIREBASE_CLIENT_X509_CERT_URL=https://...

# Database
DATABASE_URL=postgresql://user:pass@host/db

# AI/LLM
OLLAMA_API_KEY=your-ollama-key
OLLAMA_MODEL=gpt-oss:20b-cloud
OLLAMA_BASE_URL=https://ollama.com

# Search
TAVILY_API_KEY=your-tavily-key

# Storage
BLOB_READ_WRITE_TOKEN=your-vercel-token
```

---

## Prompt Moderation

The system includes a content safety layer using semantic search:

### Categories

| Category | Description |
|----------|-------------|
| `SAFE_CONTENT` | Normal, appropriate content |
| `HATE_SPEECH_PROMPT` | Discriminatory or hateful content |
| `VIOLENT_PROMPT` | Violence-related content |
| `SEXUAL_EXPLICIT_PROMPT` | Sexual or explicit content |
| `HARMFUL_INSTRUCTIONS_PROMPT` | Instructions for harmful activities |
| `SPAM_SCAM_PROMPT` | Spam or scam-related content |
| `PERSONAL_INFO_REQUEST_PROMPT` | Requests for personal information |

### Usage

Prompt moderation using `query-sense` was previously implemented but has been disabled/removed due to reliability issues. The core application no longer applies automatic prompt moderation middleware. If you want to re-enable moderation later, implement a lightweight middleware that calls a moderation service before passing the request to the agent.

### How It Works

1. Takes the user prompt and creates a classification question
2. Uses `query-sense` to semantically match against category labels
3. Returns the best matching category with confidence score
4. Blocks requests if unsafe category matches above threshold

---

## Building from Scratch

### Step 1: Project Setup

```bash
# Create project
mkdir cogniva-backend && cd cogniva-backend
pnpm init

# Install dependencies
pnpm add hono @hono/node-server @langchain/ollama @langchain/core \
  @neondatabase/serverless firebase-admin query-sense @tavily/core \
  mammoth unpdf marked axios dotenv extract-json-from-string

# Install dev dependencies
pnpm add -D typescript @types/node tsx
```

### Step 2: TypeScript Configuration

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "resolveJsonModule": true
  },
  "include": ["src/**/*"]
}
```

### Step 3: Package Scripts

```json
// package.json
{
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

### Step 4: Create Core Files

1. **Database Setup** (`src/utils/neon.ts`)
2. **Firebase Setup** (`src/utils/firebase.ts`)
3. **LLM Utility** (`src/utils/ollamaEnhanced.ts`)
4. **Entry Point** (`src/index.ts`)
5. **Route Files** (`src/routes/*.ts`)

### Step 5: Implement Agent System

1. Define types (`src/types/agent.ts`)
2. Create response schemas (`src/schemas/responseSchemas.ts`)
3. Implement tools (`src/agent/tools.ts`)
4. Build flow controller (`src/agent/bot_response_flow.ts`)

### Step 6: Add Features

1. Semantic search (`src/utils/noteSearch.ts`)
2. Document parsing (`src/utils/documentParser.ts`)
3. Prompt moderation (disabled / removed)

---

## API Reference

### Chat API

#### POST /chat
Send a message and get AI response.

**Request:**
```json
{
  "messages": [
    { "role": "human", "content": "Hello!" }
  ],
  "schema": { "response": "string" },
  "useAgent": false,
  "userId": "firebase-uid"
}
```

**Response:**
```json
[
  {
    "topic": "Greeting",
    "response": "Hello! How can I help you today?",
    "confidence": 0.95
  }
]
```

### Agent API

#### POST /agent/chat
Full agent chat with ReAct pattern.

**Request:**
```json
{
  "messages": [
    { "role": "human", "content": "Search my notes for project ideas" }
  ],
  "userId": "firebase-uid",
  "flowType": "agent"
}
```

**Response:**
```json
{
  "success": true,
  "response": {
    "type": "search",
    "topic": "Project Ideas from Notes",
    "summary": "Found 3 project ideas...",
    "results": [...],
    "confidence": 0.88
  },
  "steps": [...],
  "metadata": {
    "processingTime": 1234,
    "model": "gpt-oss:20b-cloud",
    "iterationCount": 2,
    "toolsUsed": ["searchNotes"]
  }
}
```

---

## Best Practices

### 1. Error Handling

Always wrap async operations in try-catch and return meaningful errors:

```typescript
try {
  const result = await performOperation()
  return c.json({ success: true, data: result })
} catch (error) {
  console.error('Operation failed:', error)
  return c.json({
    success: false,
    error: error instanceof Error ? error.message : 'Unknown error',
  }, 500)
}
```

### 2. Schema Validation

Use TypeScript types and validate incoming data:

```typescript
const { messages, userId } = await c.req.json()

if (!messages || !Array.isArray(messages)) {
  return c.json({ error: 'messages array is required' }, 400)
}
```

### 3. Retry Logic

Implement exponential backoff for external API calls:

```typescript
for (let attempt = 0; attempt < maxRetries; attempt++) {
  try {
    return await llm.invoke(messages)
  } catch (error) {
    if (attempt < maxRetries - 1) {
      await sleep(retryDelay * (attempt + 1)) // Exponential backoff
    }
  }
}
```

### 4. Logging

Use structured logging for debugging:

```typescript
console.log(`[Agent] Processing query: ${query.slice(0, 50)}...`)
console.log(`[Agent] Tools used: ${toolsUsed.join(', ')}`)
console.error(`[Agent] Error in step ${step}:`, error)
```

### 5. Memory Management

Reset agent context between requests:

```typescript
class BotResponseFlow {
  reset(): void {
    this.context = this.createInitialContext()
    this.abortController = null
  }
  
  async process(...) {
    this.reset() // Clean slate for each request
    // ...
  }
}
```

---

## Conclusion

Cogniva Backend demonstrates how to build a sophisticated AI-powered application with:

- **Modular Architecture**: Separate concerns into routes, utilities, and agent logic
- **ReAct Pattern**: Intelligent reasoning and tool use for better responses
- **RAG Integration**: Enhance AI responses with user's own knowledge
- **Content Safety**: Built-in moderation to prevent harmful content
- **Structured Outputs**: Predictable, typed responses for frontend integration

For questions or contributions, please refer to the project's GitHub repository.
