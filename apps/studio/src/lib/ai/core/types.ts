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
