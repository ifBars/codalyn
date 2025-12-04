/**
 * VectorStore ToolSet for semantic search functionality
 * Provides search_project tool that uses VectorStore for semantic code search
 * Supports both Gemini (local) and Mixedbread (cloud) backends
 */

import { ToolSet, ToolDefinition, ToolCall, ToolResult } from "../core/types";
import type { VectorStore } from "../../vector-store";
import type { MixedbreadVectorStore } from "../../mixedbread-vector-store";

export interface VectorStoreToolSetConfig {
    vectorStore: VectorStore | null;
    mixedbreadStore?: MixedbreadVectorStore | null;
    searchBackend?: 'gemini' | 'mixedbread' | 'auto'; // 'auto' uses Mixedbread if available
}

export class VectorStoreToolSet implements ToolSet {
    private vectorStore: VectorStore | null;
    private mixedbreadStore: MixedbreadVectorStore | null;
    private searchBackend: 'gemini' | 'mixedbread' | 'auto';

    constructor(config: VectorStoreToolSetConfig) {
        this.vectorStore = config.vectorStore;
        this.mixedbreadStore = config.mixedbreadStore || null;
        this.searchBackend = config.searchBackend || 'auto';
    }

    getDefinitions(): ToolDefinition[] {
        return [
            {
                name: "search_project",
                description: "Search the project codebase using semantic search. Use this to find relevant files and code snippets based on natural language queries. The search uses embeddings to find semantically similar code. Use this when you need to find where certain functionality is implemented.",
                parameters: {
                    type: "object",
                    properties: {
                        query: {
                            type: "string",
                            description: "Natural language search query describing what you're looking for (e.g., 'authentication logic', 'API route handlers', 'component state management')"
                        },
                        limit: {
                            type: "number",
                            description: "Maximum number of results to return (default: 5)"
                        }
                    },
                    required: ["query"]
                }
            }
        ];
    }

    async execute(toolCall: ToolCall, context?: any): Promise<ToolResult> {
        if (toolCall.name === "search_project") {
            try {
                const query = toolCall.args?.query;
                const limit = toolCall.args?.limit || 5;

                if (!query || typeof query !== 'string') {
                    return {
                        toolCallId: toolCall.id,
                        name: toolCall.name,
                        result: null,
                        error: "Missing or invalid query parameter",
                        success: false,
                    };
                }

                // Determine which backend to use
                const useMixedbread = this.shouldUseMixedbread();

                // Try Mixedbread first if selected
                if (useMixedbread && this.mixedbreadStore) {
                    try {
                        const results = await this.mixedbreadStore.search(query, limit);
                        return {
                            toolCallId: toolCall.id,
                            name: toolCall.name,
                            result: {
                                query,
                                results: results.map((r) => ({
                                    path: r.path,
                                    chunkIndex: r.chunkIndex,
                                    content: r.content,
                                    score: r.score
                                }))
                            },
                            success: true,
                        };
                    } catch (error) {
                        console.warn("Mixedbread search failed, falling back to Gemini:", error);
                        // Fall through to Gemini fallback
                    }
                }

                // Fallback to Gemini
                if (!this.vectorStore) {
                    return {
                        toolCallId: toolCall.id,
                        name: toolCall.name,
                        result: null,
                        error: "No vector store backend available",
                        success: false,
                    };
                }

                const results = await this.vectorStore.search(query, limit);

                return {
                    toolCallId: toolCall.id,
                    name: toolCall.name,
                    result: {
                        query,
                        results: results.map((r) => ({
                            path: r.path,
                            chunkIndex: r.chunkIndex,
                            content: r.content,
                            score: r.score
                        }))
                    },
                    success: true,
                };
            } catch (error) {
                return {
                    toolCallId: toolCall.id,
                    name: toolCall.name,
                    result: null,
                    error: error instanceof Error ? error.message : "Unknown error",
                    success: false,
                };
            }
        }

        return {
            toolCallId: toolCall.id,
            name: toolCall.name,
            result: null,
            error: `Unknown tool: ${toolCall.name}`,
            success: false,
        };
    }

    hasTool(name: string): boolean {
        return name === "search_project";
    }

    /**
     * Determine which backend to use based on configuration
     */
    private shouldUseMixedbread(): boolean {
        if (this.searchBackend === 'gemini') {
            return false;
        }
        if (this.searchBackend === 'mixedbread') {
            return true;
        }
        // 'auto': use Mixedbread if available, otherwise Gemini
        return this.mixedbreadStore !== null;
    }

    /**
     * Update the vector store instance
     */
    setVectorStore(vectorStore: VectorStore | null): void {
        this.vectorStore = vectorStore;
    }

    /**
     * Update the Mixedbread store instance
     */
    setMixedbreadStore(mixedbreadStore: MixedbreadVectorStore | null): void {
        this.mixedbreadStore = mixedbreadStore;
    }
}

