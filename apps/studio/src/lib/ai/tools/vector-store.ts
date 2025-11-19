/**
 * VectorStore ToolSet for semantic search functionality
 * Provides search_project tool that uses VectorStore for semantic code search
 */

import { ToolSet, ToolDefinition, ToolCall, ToolResult } from "../core/types";
import type { VectorStore } from "../../vector-store";

export interface VectorStoreToolSetConfig {
    vectorStore: VectorStore | null;
}

export class VectorStoreToolSet implements ToolSet {
    private vectorStore: VectorStore | null;

    constructor(config: VectorStoreToolSetConfig) {
        this.vectorStore = config.vectorStore;
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

                if (!this.vectorStore) {
                    return {
                        toolCallId: toolCall.id,
                        name: toolCall.name,
                        result: null,
                        error: "Vector store not initialized",
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
     * Update the vector store instance
     */
    setVectorStore(vectorStore: VectorStore | null): void {
        this.vectorStore = vectorStore;
    }
}

