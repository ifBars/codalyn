/**
 * Backend adapters for LLM providers
 */

export {
  AnthropicBackend,
  createAnthropicBackend,
  type AnthropicBackendConfig,
} from './anthropic';

export {
  OpenAIBackend,
  createOpenAIBackend,
  type OpenAIBackendConfig,
} from './openai';

export {
  OllamaBackend,
  createOllamaBackend,
  type OllamaBackendConfig,
} from './ollama';

export {
  VercelAIBackend,
  createVercelAIBackend,
  type VercelAIBackendConfig,
} from './vercel-ai';
