/**
 * Public API for the AI module
 */

// Core types
export * from "./core/types";
export { filterResponseText, containsCodeWithoutTools } from "./core/filters";
export { getDefaultSystemPrompt } from "./core/prompts";
export {
  extractFileOperations,
  filterValidFileOperations,
  normalizeToolCall,
  normalizeToolResult,
  matchToolCallsWithResults,
  parseToolCalls,
  parseToolResults,
  validateFileOperation,
} from "./core/parser";

// Core classes
export { Agent } from "./core/agent";
export { ConversationMemory } from "./core/memory";

// Providers
export { AccuralAIAdapter } from "./providers/accuralai";
export type { AccuralAIAdapterConfig } from "./providers/accuralai";

// Tools
export { CodalynToolSet } from "./tools/index";
export { BrowserToolSet } from "./tools/browser";
export type { BrowserToolSetConfig } from "./tools/browser";
export { CompositeToolSet } from "./tools/composite";
export { VectorStoreToolSet } from "./tools/vector-store";
export type { VectorStoreToolSetConfig } from "./tools/vector-store";
export { Context7ToolSet } from "./tools/context7";
export type { Context7ToolSetConfig } from "./tools/context7";

// Sandbox
export { WebContainerSandbox } from "./sandbox/webcontainer-sandbox";

// MDAP orchestration helpers
export { createBuilderMdapOrchestrator } from "./mdap";

/**
 * Convenience function to create a fully configured agent
 */
import { Agent } from "./core/agent";
import { AccuralAIAdapter } from "./providers/accuralai";
import { CodalynToolSet } from "./tools/index";
import { ConversationMemory } from "./core/memory";
import type { SandboxInterface } from "@codalyn/sandbox";

export interface CreateAgentOptions {
    modelName?: string;
    sandbox: SandboxInterface;
    systemPrompt?: string;
    maxIterations?: number;
    googleApiKey?: string;
}

export function createAgent(options: CreateAgentOptions): Agent {
    if (!options.googleApiKey) {
        throw new Error("Google API key is required to create an agent");
    }

    const adapter = new AccuralAIAdapter({
        googleApiKey: options.googleApiKey,
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
