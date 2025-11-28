# AccuralAI

**Unified TypeScript package for local LLM orchestration with MDAP multi-agent support**

AccuralAI is a batteries-included TypeScript library for building LLM-powered applications with advanced features like multi-agent orchestration, intelligent caching, and React integration. Perfect for building web apps with WebContainers, MDAP/MAKER architectures, and agentic workflows.

## Features

- 🚀 **Core Pipeline Orchestration** - Complete request/response lifecycle management
- 💾 **Advanced Caching** - Memory, disk (SQLite), and layered caching with LRU and TTL
- 🤖 **Multiple Backend Adapters** - Anthropic Claude, OpenAI, and Ollama support
- 🔀 **MDAP Multi-Agent System** - Orchestrate multiple specialized sub-agents
- ⚛️ **React Hooks** - Easy integration with React applications
- 📦 **Single Package** - All functionality in one npm install
- 🌐 **WebContainer Compatible** - Works in browser environments
- 📝 **Full TypeScript** - Complete type safety with Zod validation

## Installation

```bash
npm install accuralai
# or
pnpm add accuralai
# or
yarn add accuralai
```

### Required Peer Dependencies

For React integration:
```bash
npm install react@^18.0.0
```

For backend adapters:
```bash
npm install @anthropic-ai/sdk openai better-sqlite3
```

## Quick Start

### Simple Text Generation

```typescript
import { createAnthropicBackend, createRequest } from 'accuralai';

const backend = createAnthropicBackend({
  apiKey: process.env.ANTHROPIC_API_KEY,
  defaultModel: 'claude-sonnet-4-5-20250929',
});

const request = createRequest({
  prompt: 'Explain quantum computing in simple terms',
  parameters: { temperature: 0.7, maxTokens: 500 },
});

const response = await backend.generate(request, { routedTo: 'direct' });
console.log(response.outputText);
```

### With Caching

```typescript
import {
  Pipeline,
  createExecutionContext,
  createRequest,
  PassthroughCanonicalizer,
  DirectRouter,
  NoopValidator,
  NoopInstrumentation,
  createAnthropicBackend,
  createMemoryCache,
} from 'accuralai';

const pipeline = new Pipeline({
  canonicalizer: new PassthroughCanonicalizer(),
  cache: await createMemoryCache({ maxEntries: 100, defaultTtl: 3600 }),
  router: new DirectRouter({ defaultBackend: 'anthropic' }),
  backends: {
    anthropic: createAnthropicBackend(),
  },
  validator: new NoopValidator(),
  instrumentation: new NoopInstrumentation(),
  cacheStrategy: (req) => req.cacheKey || req.prompt.slice(0, 50),
  stagePlugins: {},
});

const request = createRequest({
  prompt: 'What is TypeScript?',
});

const ctx = createExecutionContext(request);
const response = await pipeline.run(ctx);

console.log(response.outputText);
console.log('Cache status:', response.metadata.cacheStatus);
```

## Multi-Agent Orchestration (MDAP)

Build complex agentic workflows with specialized sub-agents:

```typescript
import {
  createOrchestrator,
  createTaskRouter,
  SubAgentPresets,
  RoutingRulePresets,
  createAnthropicBackend,
} from 'accuralai';

const backend = createAnthropicBackend();

// Create specialized sub-agents
const router = createTaskRouter({
  rules: [
    RoutingRulePresets.codeGeneration,
    RoutingRulePresets.testing,
    RoutingRulePresets.codeReview,
  ],
});

// Register sub-agents with presets
router.registerAgent(
  new SubAgent(SubAgentPresets.codeGenerator(backend))
);
router.registerAgent(
  new SubAgent(SubAgentPresets.tester(backend))
);
router.registerAgent(
  new SubAgent(SubAgentPresets.reviewer(backend))
);

// Create orchestrator
const orchestrator = createOrchestrator({
  router,
  maxParallelTasks: 3,
});

// Execute complex task
const result = await orchestrator.execute({
  prompt: 'Build a todo list component in React with TypeScript',
  workflow: 'sequential', // or 'parallel', 'conditional'
});

console.log('Final output:', result.finalOutput);
console.log('Agents used:', result.routingDecisions.map(d => d.agentId));
```

### Custom Sub-Agents

```typescript
import { createSubAgent, createAgent } from 'accuralai';

const customAgent = createSubAgent({
  id: 'api-designer',
  name: 'API Designer',
  role: 'api-design',
  specialization: 'api-design',
  capabilities: ['rest', 'graphql', 'openapi'],
  systemPrompt: 'You are an API design expert. Create well-structured, RESTful APIs.',
  backend,
  priority: 7,
  temperature: 0.4,
});

router.registerAgent(customAgent);
```

## React Integration

### Setup Provider

```tsx
import { AccuralAIProvider } from 'accuralai/react';
import { createAnthropicBackend, createOpenAIBackend } from 'accuralai';

function App() {
  return (
    <AccuralAIProvider
      config={{
        backends: {
          anthropic: createAnthropicBackend({
            apiKey: process.env.REACT_APP_ANTHROPIC_API_KEY,
          }),
          openai: createOpenAIBackend({
            apiKey: process.env.REACT_APP_OPENAI_API_KEY,
          }),
        },
        defaultBackend: 'anthropic',
      }}
    >
      <YourApp />
    </AccuralAIProvider>
  );
}
```

### Using Hooks

#### Simple Generation

```tsx
import { useGenerate } from 'accuralai/react';

function ChatComponent() {
  const { generate, loading, error, response } = useGenerate('anthropic');
  const [prompt, setPrompt] = useState('');

  const handleSubmit = async () => {
    await generate(prompt, {
      temperature: 0.7,
      maxTokens: 1000,
    });
  };

  return (
    <div>
      <input value={prompt} onChange={(e) => setPrompt(e.target.value)} />
      <button onClick={handleSubmit} disabled={loading}>
        {loading ? 'Generating...' : 'Generate'}
      </button>
      {error && <p>Error: {error.message}</p>}
      {response && <p>{response.outputText}</p>}
    </div>
  );
}
```

#### Agent Hook

```tsx
import { useAgent } from 'accuralai/react';

function AgentChat() {
  const agent = useAgent({
    role: 'code-assistant',
    systemPrompt: 'You are a helpful coding assistant',
    backendName: 'anthropic',
  });

  const handleAsk = async (question: string) => {
    const result = await agent.execute(question);
    console.log(result.output);
  };

  return (
    <div>
      <button onClick={() => handleAsk('How do I use React hooks?')}>
        Ask Question
      </button>
      <div>
        <h3>History:</h3>
        {agent.history.map((msg, i) => (
          <p key={i}><strong>{msg.role}:</strong> {msg.content}</p>
        ))}
      </div>
    </div>
  );
}
```

#### Multi-Agent Orchestration

```tsx
import { useSubAgents, SubAgentPresets } from 'accuralai/react';

function WebAppBuilder() {
  const { executeTask, loading, result, getStats } = useSubAgents({
    agents: {
      codeGen: { preset: 'codeGenerator' },
      tester: { preset: 'tester' },
      reviewer: { preset: 'reviewer' },
      designer: { preset: 'designer' },
    },
    backendName: 'anthropic',
  });

  const buildApp = async () => {
    const result = await executeTask({
      prompt: 'Create a login form with email validation',
      workflow: 'sequential',
    });

    console.log('Generated code:', result.finalOutput);
    console.log('Stats:', getStats());
  };

  return (
    <div>
      <button onClick={buildApp} disabled={loading}>
        {loading ? 'Building...' : 'Build Component'}
      </button>
      {result && (
        <div>
          <h3>Result:</h3>
          <pre>{result.finalOutput}</pre>
          <p>Agents used: {result.routingDecisions.map(d => d.agentId).join(', ')}</p>
        </div>
      )}
    </div>
  );
}
```

#### Streaming

```tsx
import { useStreaming } from 'accuralai/react';

function StreamingChat() {
  const { stream, loading, content, done } = useStreaming('anthropic');

  return (
    <div>
      <button onClick={() => stream('Tell me a story')} disabled={loading}>
        Stream Story
      </button>
      <div>
        <p>{content}</p>
        {done && <p>✓ Complete</p>}
      </div>
    </div>
  );
}
```

## Backend Adapters

### Anthropic Claude

```typescript
import { createAnthropicBackend } from 'accuralai';

const claude = createAnthropicBackend({
  apiKey: process.env.ANTHROPIC_API_KEY,
  defaultModel: 'claude-sonnet-4-5-20250929',
  maxTokens: 4096,
});
```

**Supported Models:**
- `claude-sonnet-4-5-20250929` (recommended)
- `claude-3-5-sonnet-20241022`
- `claude-3-opus-20240229`

### OpenAI

```typescript
import { createOpenAIBackend } from 'accuralai';

const openai = createOpenAIBackend({
  apiKey: process.env.OPENAI_API_KEY,
  defaultModel: 'gpt-4o',
});
```

**Azure OpenAI:**
```typescript
const azure = createOpenAIBackend({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  azureEndpoint: 'https://your-resource.openai.azure.com',
  azureDeployment: 'gpt-4',
  azureApiVersion: '2024-02-15-preview',
});
```

### Ollama (Local)

```typescript
import { createOllamaBackend } from 'accuralai';

const ollama = createOllamaBackend({
  baseURL: 'http://localhost:11434',
  defaultModel: 'llama3.2',
});

// List available models
const models = await ollama.listModels();
```

## Advanced Caching

### Memory Cache (LRU)

```typescript
import { createMemoryCache } from 'accuralai';

const cache = await createMemoryCache({
  maxEntries: 1000,
  defaultTtl: 3600, // 1 hour
  eagerExpiry: true,
});
```

### Disk Cache (SQLite)

```typescript
import { createDiskCache } from 'accuralai';

const cache = await createDiskCache({
  path: '.cache/accuralai.sqlite',
  sizeLimitMb: 100,
  vacuumOnStart: true,
});
```

### Layered Cache (Memory + Disk)

```typescript
import { createLayeredCache } from 'accuralai';

const cache = await createLayeredCache({
  memory: { maxEntries: 100 },
  disk: { path: '.cache/accuralai.sqlite', sizeLimitMb: 500 },
  promoteOnHit: true, // Promote disk hits to memory
});

// Get stats
const stats = cache.getStats();
console.log('Hit rate:', stats.hitRate);
```

## WebContainer Support

AccuralAI works in browser environments! For WebContainers, use memory-based caching:

```typescript
import { createMemoryCache } from 'accuralai';

// In browser: use memory cache instead of disk
const cache = await createMemoryCache({ maxEntries: 100 });

// Tree-shakeable imports work great
import { createAnthropicBackend } from 'accuralai/backends/anthropic';
```

## API Reference

### Core Types

```typescript
// Request
interface GenerateRequest {
  id: string;
  prompt: string;
  systemPrompt?: string;
  history?: Array<{ role: string; content: string }>;
  parameters?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

// Response
interface GenerateResponse {
  id: string;
  requestId: string;
  outputText: string;
  finishReason: 'stop' | 'length' | 'content_filter' | 'error';
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  latencyMs: number;
  metadata?: Record<string, unknown>;
}
```

### MDAP Types

```typescript
// Agent
class Agent {
  constructor(config: AgentConfig);
  execute(task: AgentTask): Promise<AgentResult>;
  clearHistory(): void;
  getHistory(): Array<{ role: string; content: string }>;
}

// Sub-Agent
class SubAgent extends Agent {
  canHandle(task: AgentTask): boolean;
  getLoad(): { active: number; max: number; utilization: number };
}

// Orchestrator
class MDAPOrchestrator {
  constructor(config: OrchestratorConfig);
  execute(task: OrchestratorTask): Promise<OrchestratorResult>;
  getStats(): OrchestratorStats;
}
```

## Examples

Check out the `/examples` directory for complete examples:
- Basic chat application
- Multi-agent code generator
- React integration
- WebContainer usage

## Documentation

Full API documentation: [https://accuralai.readthedocs.io](https://accuralai.readthedocs.io)

## Sources

This package integrates with official SDKs:
- [Anthropic Claude SDK](https://github.com/anthropics/anthropic-sdk-typescript)
- [OpenAI Node SDK](https://github.com/openai/openai-node)
- [Ollama API](https://github.com/ollama/ollama/blob/main/docs/api.md)

## License

Apache-2.0

## Contributing

Contributions welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Support

- GitHub Issues: [https://github.com/accuralai/accuralai-typescript/issues](https://github.com/accuralai/accuralai-typescript/issues)
- Documentation: [https://accuralai.readthedocs.io](https://accuralai.readthedocs.io)
