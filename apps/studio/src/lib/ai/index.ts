/**
 * Public API for the AI module
 */

// Core types
export * from "./core/types";

// Core classes
export { Agent } from "./core/agent";
export { ConversationMemory } from "./core/memory";

// Providers
export { GeminiAdapter } from "./providers/gemini";
export type { GeminiAdapterConfig } from "./providers/gemini";

// Tools
export { CodalynToolSet } from "./tools/index";
export { BrowserToolSet } from "./tools/browser";
export type { BrowserToolSetConfig } from "./tools/browser";
export { CompositeToolSet } from "./tools/composite";

// Sandbox
export { WebContainerSandbox } from "./sandbox/webcontainer-sandbox";

/**
 * Convenience function to create a fully configured agent
 */
import { Agent } from "./core/agent";
import { GeminiAdapter } from "./providers/gemini";
import { CodalynToolSet } from "./tools/index";
import { ConversationMemory } from "./core/memory";
import type { SandboxInterface } from "@codalyn/sandbox";

export interface CreateAgentOptions {
    apiKey: string;
    modelName?: string;
    sandbox: SandboxInterface;
    systemPrompt?: string;
    maxIterations?: number;
}

export function createAgent(options: CreateAgentOptions): Agent {
    const adapter = new GeminiAdapter({
        apiKey: options.apiKey,
        modelName: options.modelName,
    });

    const toolSet = new CodalynToolSet(options.sandbox);
    const memory = new ConversationMemory(options.systemPrompt);

    return new Agent({
        modelAdapter: adapter,
        tools: toolSet,
        memory,
        maxIterations: options.maxIterations,
    });
}
