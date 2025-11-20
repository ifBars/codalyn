/**
 * Core type definitions for the agentic AI system
 */

/**
 * A message in the conversation
 */
export interface Message {
    role: "system" | "user" | "assistant" | "tool";
    content?: string;
    toolCalls?: ToolCall[];
    toolResults?: ToolResult[];
    timestamp?: Date;
}

/**
 * A tool call made by the assistant
 */
export interface ToolCall {
    id?: string;
    name: string;
    args: Record<string, any>;
}

/**
 * The result of a tool execution
 */
export interface ToolResult {
    toolCallId?: string;
    name: string;
    result: any;
    error?: string;
    success: boolean;
}

/**
 * Configuration for an Agent
 */
export interface AgentConfig {
    modelAdapter: ModelAdapter;
    tools: ToolSet;
    memory: Memory;
    maxIterations?: number;
    maxTokens?: number;
    systemPrompt?: string;
}

/**
 * Interface for different LLM providers
 */
export interface ModelAdapter {
    /**
     * Generate a response with optional tool calls
     */
    generate(messages: Message[], tools: ToolDefinition[]): Promise<ModelResponse>;

    /**
     * Stream a response with optional tool calls
     */
    generateStream(
        messages: Message[],
        tools: ToolDefinition[]
    ): AsyncGenerator<ModelStreamChunk>;

    /**
     * Get the model name
     */
    getModelName(): string;
}

/**
 * Response from the model
 */
export interface ModelResponse {
    content?: string;
    toolCalls?: ToolCall[];
    finishReason?: "stop" | "tool_calls" | "max_tokens" | "error";
}

/**
 * Chunk from a streaming response
 */
export interface ModelStreamChunk {
    type: "text" | "tool_call";
    content?: string;
    toolCall?: ToolCall;
    finishReason?: "stop" | "tool_calls" | "max_tokens" | "error";
}

/**
 * Tool definition for the model
 */
export interface ToolDefinition {
    name: string;
    description: string;
    parameters: Record<string, any>; // JSON Schema
}

/**
 * A set of tools available to the agent
 */
export interface ToolSet {
    /**
     * Get all tool definitions
     */
    getDefinitions(): ToolDefinition[];

    /**
     * Execute a tool
     */
    execute(toolCall: ToolCall, context?: any): Promise<ToolResult>;

    /**
     * Check if a tool exists
     */
    hasTool(name: string): boolean;
}

/**
 * Memory/conversation history management
 */
export interface Memory {
    /**
     * Add a message to the history
     */
    addMessage(message: Message): void;

    /**
     * Get all messages
     */
    getMessages(): Message[];

    /**
     * Get messages with context window applied
     */
    getContextWindow(maxTokens?: number): Message[];

    /**
     * Clear all messages
     */
    clear(): void;

    /**
     * Get the system prompt
     */
    getSystemPrompt(): string | undefined;

    /**
     * Set the system prompt
     */
    setSystemPrompt(prompt: string): void;
}

/**
 * Events emitted by the Agent during execution
 */
export type AgentEvent =
    | { type: "thought"; content: string }
    | { type: "tool_call"; toolCall: ToolCall }
    | { type: "tool_result"; toolResult: ToolResult }
    | { type: "response"; content: string }
    | { type: "error"; error: string }
    | { type: "iteration"; iteration: number; maxIterations: number }
    | { type: "done" };

/**
 * Agent execution result
 */
export interface AgentResult {
    finalResponse: string;
    toolCalls: ToolCall[];
    toolResults: ToolResult[];
    iterations: number;
    messages: Message[];
}

/**
 * Compatibility types for UI integration
 * These types match the format expected by the builder UI components
 */

/**
 * Backend provider type
 */
export type BackendProvider = "gemini" | "openrouter";

/**
 * Gemini model identifier
 */
export type GeminiModelId =
    | "gemini-2.5-flash"
    | "gemini-2.5-flash-lite"
    | "gemini-flash-lite-latest"
    | "gemini-2.5-pro"
    | "gemini-flash-latest";

/**
 * OpenRouter model identifier
 * Based on https://openrouter.ai/docs/overview/models
 */
export type OpenRouterModelId =
    // Auto selection
    | "openrouter/auto"
    // OpenAI models
    | "openai/gpt-4o"
    | "openai/gpt-4o-mini"
    | "openai/gpt-4-turbo"
    | "openai/gpt-4"
    | "openai/gpt-3.5-turbo"
    | "openai/gpt-5"
    // Anthropic Claude models
    | "anthropic/claude-3.5-sonnet"
    | "anthropic/claude-3.5-haiku"
    | "anthropic/claude-3-opus"
    | "anthropic/claude-3-sonnet"
    | "anthropic/claude-3-haiku"
    | "anthropic/claude-sonnet-4.5"
    | "anthropic/claude-haiku-4.5"
    // Google Gemini models
    | "google/gemini-pro-1.5"
    | "google/gemini-flash-1.5"
    | "google/gemini-2.0-flash-exp"
    | "google/gemini-2.0-flash-thinking-exp"
    | "google/gemini-2.5-flash"
    // Meta Llama models
    | "meta-llama/llama-3.1-405b-instruct"
    | "meta-llama/llama-3.1-70b-instruct"
    | "meta-llama/llama-3.1-8b-instruct"
    | "meta-llama/llama-3-70b-instruct"
    // Mistral models
    | "mistralai/mistral-large"
    | "mistralai/mixtral-8x7b-instruct"
    | "mistralai/mixtral-8x22b-instruct"
    // Cohere models
    | "cohere/command-r-plus"
    | "cohere/command-r"
    // Perplexity models
    | "perplexity/llama-3.1-sonar-large-128k-online"
    | "perplexity/llama-3.1-sonar-small-128k-online"
    // DeepSeek models
    | "deepseek/deepseek-chat"
    | "deepseek/deepseek-coder"
    // Qwen models
    | "qwen/qwen-2.5-72b-instruct"
    | "qwen/qwen-2.5-32b-instruct"
    | "qwen/qwen3-coder:free"
    // Additional Google models
    | "google/gemini-3-pro-preview"
    | "google/gemma-3n-e2b-it:free"
    // xAI Grok models
    | "x-ai/grok-4.1-fast"
    | "x-ai/grok-code-fast-1"
    // Free coding models
    | "kwaipilot/kat-coder-pro:free"
    // NVIDIA models
    | "nvidia/nemotron-nano-12b-v2-vl:free"
    | "nvidia/nemotron-nano-9b-v2:free"
    // Alibaba models
    | "alibaba/tongyi-deepresearch-30b-a3b:free"
    // Meituan models
    | "meituan/longcat-flash-chat:free"
    // OpenAI free models
    | "openai/gpt-oss-20b:free"
    // Z-AI models
    | "z-ai/glm-4.5-air:free"
    | "z-ai/glm-4.6"
    // Moonshot models
    | "moonshotai/kimi-k2:free"
    // CognitiveComputations models
    | "cognitivecomputations/dolphin-mistral-24b-venice-edition:free"
    // TNGTech models
    | "tngtech/deepseek-r1t2-chimera:free"
    // DeepSeek reasoning models
    | "deepseek/deepseek-r1:free"
    // Mistral free models
    | "mistralai/mistral-small-3.2-24b-instruct:free"
    // Minimax models
    | "minimax/minimax-m2";

/**
 * File operation for compatibility with old system
 */
export interface FileOperation {
    type: "write" | "delete" | "install_package";
    path?: string;
    content?: string;
    packages?: string[];
}

/**
 * AI message format for compatibility with old system
 */
export interface AIMessage {
    role: "user" | "assistant";
    content: string;
    screenshot?: string; // base64 encoded image
    operations?: FileOperation[];
}

/**
 * Gemini model options for UI selection
 */
export const GEMINI_MODEL_OPTIONS: Array<{
    id: GeminiModelId;
    label: string;
    description: string;
}> = [
    {
        id: "gemini-2.5-flash",
        label: "Gemini 2.5 Flash",
        description: "Fast, capable generalist for most UI builds.",
    },
    {
        id: "gemini-2.5-flash-lite",
        label: "Gemini 2.5 Flash Lite",
        description: "Default balance of speed + quality.",
    },
    {
        id: "gemini-flash-latest",
        label: "Gemini 2.5 Flash (latest)",
        description: "Cutting edge lite model with latest weights.",
    },
    {
        id: "gemini-flash-lite-latest",
        label: "Gemini 2.5 Flash Lite (latest)",
        description: "Lightweight model ideal for rapid prototyping.",
    },
    {
        id: "gemini-2.5-pro",
        label: "Gemini 2.5 Pro",
        description: "Highest quality responses, slower latency.",
    },
];

/**
 * OpenRouter model options for UI selection
 * Based on https://openrouter.ai/docs/overview/models
 */
export const OPENROUTER_MODEL_OPTIONS: Array<{
    id: OpenRouterModelId;
    label: string;
    description: string;
}> = [
    {
        id: "openrouter/auto",
        label: "Auto (Best Model)",
        description: "Automatically selects the best available model.",
    },
    // OpenAI Models
    {
        id: "openai/gpt-4o",
        label: "GPT-4o",
        description: "OpenAI's most advanced multimodal model with vision support.",
    },
    {
        id: "openai/gpt-4o-mini",
        label: "GPT-4o Mini",
        description: "Fast and efficient GPT-4 variant, great for speed.",
    },
    {
        id: "openai/gpt-4-turbo",
        label: "GPT-4 Turbo",
        description: "Enhanced GPT-4 with improved performance and lower latency.",
    },
    {
        id: "openai/gpt-4",
        label: "GPT-4",
        description: "OpenAI's flagship model with strong reasoning capabilities.",
    },
    {
        id: "openai/gpt-3.5-turbo",
        label: "GPT-3.5 Turbo",
        description: "Fast and cost-effective for simple tasks.",
    },
    {
        id: "openai/gpt-5",
        label: "GPT-5",
        description: "OpenAI's next-generation model with advanced reasoning capabilities.",
    },
    // Anthropic Claude Models
    {
        id: "anthropic/claude-3.5-sonnet",
        label: "Claude 3.5 Sonnet",
        description: "Anthropic's balanced performance model, excellent for coding.",
    },
    {
        id: "anthropic/claude-3.5-haiku",
        label: "Claude 3.5 Haiku",
        description: "Fastest Claude model, great for quick responses.",
    },
    {
        id: "anthropic/claude-3-opus",
        label: "Claude 3 Opus",
        description: "Anthropic's most capable model for complex reasoning.",
    },
    {
        id: "anthropic/claude-3-sonnet",
        label: "Claude 3 Sonnet",
        description: "Previous generation Sonnet, still very capable.",
    },
    {
        id: "anthropic/claude-3-haiku",
        label: "Claude 3 Haiku",
        description: "Previous generation Haiku, fast and efficient.",
    },
    {
        id: "anthropic/claude-sonnet-4.5",
        label: "Claude Sonnet 4.5",
        description: "Anthropic's latest Sonnet model with enhanced capabilities.",
    },
    {
        id: "anthropic/claude-haiku-4.5",
        label: "Claude Haiku 4.5",
        description: "Anthropic's latest Haiku model optimized for speed and efficiency.",
    },
    // Google Gemini Models
    {
        id: "google/gemini-pro-1.5",
        label: "Gemini Pro 1.5",
        description: "Google's advanced Gemini model with large context window.",
    },
    {
        id: "google/gemini-flash-1.5",
        label: "Gemini Flash 1.5",
        description: "Fast Gemini model optimized for speed and efficiency.",
    },
    {
        id: "google/gemini-2.0-flash-exp",
        label: "Gemini 2.0 Flash (Experimental)",
        description: "Latest experimental Gemini model with improved capabilities.",
    },
    {
        id: "google/gemini-2.0-flash-thinking-exp",
        label: "Gemini 2.0 Flash Thinking",
        description: "Gemini with reasoning tokens for complex problem-solving.",
    },
    {
        id: "google/gemini-2.5-flash",
        label: "Gemini 2.5 Flash",
        description: "Google's latest Gemini Flash model with improved performance and speed.",
    },
    // Meta Llama Models
    {
        id: "meta-llama/llama-3.1-405b-instruct",
        label: "Llama 3.1 405B",
        description: "Meta's largest open-source model, extremely capable.",
    },
    {
        id: "meta-llama/llama-3.1-70b-instruct",
        label: "Llama 3.1 70B",
        description: "Meta's powerful open-source model, great balance.",
    },
    {
        id: "meta-llama/llama-3.1-8b-instruct",
        label: "Llama 3.1 8B",
        description: "Lightweight Llama model, fast and efficient.",
    },
    {
        id: "meta-llama/llama-3-70b-instruct",
        label: "Llama 3 70B",
        description: "Previous generation Llama 3, still very capable.",
    },
    // Mistral Models
    {
        id: "mistralai/mistral-large",
        label: "Mistral Large",
        description: "Mistral's flagship model with strong reasoning.",
    },
    {
        id: "mistralai/mixtral-8x7b-instruct",
        label: "Mixtral 8x7B",
        description: "Mixture-of-experts model, efficient and capable.",
    },
    {
        id: "mistralai/mixtral-8x22b-instruct",
        label: "Mixtral 8x22B",
        description: "Larger Mixtral model with improved performance.",
    },
    // Cohere Models
    {
        id: "cohere/command-r-plus",
        label: "Command R+",
        description: "Cohere's advanced model with strong reasoning.",
    },
    {
        id: "cohere/command-r",
        label: "Command R",
        description: "Cohere's balanced model, good for general tasks.",
    },
    // Perplexity Models
    {
        id: "perplexity/llama-3.1-sonar-large-128k-online",
        label: "Sonar Large (Online)",
        description: "Perplexity's online model with web search capabilities.",
    },
    {
        id: "perplexity/llama-3.1-sonar-small-128k-online",
        label: "Sonar Small (Online)",
        description: "Faster Perplexity model with web search.",
    },
    // DeepSeek Models
    {
        id: "deepseek/deepseek-chat",
        label: "DeepSeek Chat",
        description: "Strong reasoning model, excellent for coding tasks.",
    },
    {
        id: "deepseek/deepseek-coder",
        label: "DeepSeek Coder",
        description: "Specialized coding model with code generation focus.",
    },
    // Qwen Models
    {
        id: "qwen/qwen-2.5-72b-instruct",
        label: "Qwen 2.5 72B",
        description: "Alibaba's large model with strong multilingual support.",
    },
    {
        id: "qwen/qwen-2.5-32b-instruct",
        label: "Qwen 2.5 32B",
        description: "Balanced Qwen model, efficient and capable.",
    },
    // Additional Google Models
    {
        id: "google/gemini-3-pro-preview",
        label: "Gemini 3 Pro (Preview)",
        description: "Latest Google Gemini Pro model preview with advanced capabilities.",
    },
    {
        id: "google/gemma-3n-e2b-it:free",
        label: "Gemma 3N E2B (Free)",
        description: "Google's free Gemma model optimized for instruction following.",
    },
    // xAI Grok Models
    {
        id: "x-ai/grok-4.1-fast",
        label: "Grok 4.1 Fast",
        description: "xAI's fast Grok model with real-time capabilities.",
    },
    {
        id: "x-ai/grok-code-fast-1",
        label: "Grok Code Fast",
        description: "xAI's specialized coding model optimized for speed.",
    },
    // Free Coding Models
    {
        id: "kwaipilot/kat-coder-pro:free",
        label: "Kat Coder Pro (Free)",
        description: "Free specialized coding model with strong code generation.",
    },
    // NVIDIA Models (Free)
    {
        id: "nvidia/nemotron-nano-12b-v2-vl:free",
        label: "Nemotron Nano 12B VL (Free)",
        description: "NVIDIA's free vision-language model with multimodal capabilities.",
    },
    {
        id: "nvidia/nemotron-nano-9b-v2:free",
        label: "Nemotron Nano 9B (Free)",
        description: "NVIDIA's free efficient model for general tasks.",
    },
    // Alibaba Models (Free)
    {
        id: "alibaba/tongyi-deepresearch-30b-a3b:free",
        label: "Tongyi DeepResearch 30B (Free)",
        description: "Alibaba's free research-focused model with deep reasoning.",
    },
    // Meituan Models (Free)
    {
        id: "meituan/longcat-flash-chat:free",
        label: "LongCat Flash Chat (Free)",
        description: "Meituan's free fast chat model optimized for conversations.",
    },
    // OpenAI Free Models
    {
        id: "openai/gpt-oss-20b:free",
        label: "GPT OSS 20B (Free)",
        description: "OpenAI's free open-source style model.",
    },
    // Z-AI Models (Free)
    {
        id: "z-ai/glm-4.5-air:free",
        label: "GLM-4.5 Air (Free)",
        description: "Z-AI's free lightweight GLM model.",
    },
    {
        id: "z-ai/glm-4.6",
        label: "GLM-4.6",
        description: "Z-AI's latest GLM model with enhanced capabilities.",
    },
    // Qwen Free Models
    {
        id: "qwen/qwen3-coder:free",
        label: "Qwen3 Coder (Free)",
        description: "Qwen's free specialized coding model.",
    },
    // Moonshot Models (Free)
    {
        id: "moonshotai/kimi-k2:free",
        label: "Kimi K2 (Free)",
        description: "Moonshot's free Kimi model with enhanced capabilities.",
    },
    // CognitiveComputations Models (Free)
    {
        id: "cognitivecomputations/dolphin-mistral-24b-venice-edition:free",
        label: "Dolphin Mistral 24B Venice (Free)",
        description: "Free Mistral-based model with Venice edition enhancements.",
    },
    // TNGTech Models (Free)
    {
        id: "tngtech/deepseek-r1t2-chimera:free",
        label: "DeepSeek R1 T2 Chimera (Free)",
        description: "TNGTech's free DeepSeek reasoning model variant.",
    },
    // DeepSeek Reasoning Models (Free)
    {
        id: "deepseek/deepseek-r1:free",
        label: "DeepSeek R1 (Free)",
        description: "DeepSeek's free reasoning model with chain-of-thought capabilities.",
    },
    // Mistral Free Models
    {
        id: "mistralai/mistral-small-3.2-24b-instruct:free",
        label: "Mistral Small 3.2 24B (Free)",
        description: "Mistral's free smaller model optimized for instruction following.",
    },
    // Minimax Models
    {
        id: "minimax/minimax-m2",
        label: "Minimax M2",
        description: "Minimax's advanced model with strong reasoning and coding capabilities.",
    },
];

/**
 * Default Gemini model
 */
export const DEFAULT_GEMINI_MODEL: GeminiModelId = "gemini-2.5-flash-lite";

/**
 * Default OpenRouter model
 */
export const DEFAULT_OPENROUTER_MODEL: OpenRouterModelId = "openrouter/auto";