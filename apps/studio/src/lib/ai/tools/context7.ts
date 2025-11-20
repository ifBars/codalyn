/**
 * Context7 ToolSet - Provides access to up-to-date library documentation via Context7 API
 */

import { ToolSet, ToolDefinition, ToolCall, ToolResult } from "../core/types";

export interface Context7ToolSetConfig {
  apiKey: string;
}

export class Context7ToolSet implements ToolSet {
  private apiKey: string;

  constructor(config: Context7ToolSetConfig) {
    this.apiKey = config.apiKey;
  }

  getDefinitions(): ToolDefinition[] {
    return [
      {
        name: "context7_get_docs",
        description: "Get up-to-date documentation for a library from Context7. Use this to fetch the latest documentation for libraries, frameworks, or packages.",
        parameters: {
          type: "object",
          properties: {
            library: {
              type: "string",
              description: "Library identifier in format 'org/project' (e.g., 'vercel/next.js', 'mongodb/docs') or just the project name",
            },
            topic: {
              type: "string",
              description: "Optional topic to focus the documentation on (e.g., 'routing', 'hooks', 'authentication')",
            },
            tokens: {
              type: "number",
              description: "Maximum number of tokens to fetch (default: 5000). Lower values are faster but may have less context.",
              default: 5000,
            },
            version: {
              type: "string",
              description: "Optional specific version to fetch (e.g., 'v15.1.8'). If not specified, fetches latest.",
            },
          },
          required: ["library"],
        },
      },
      {
        name: "context7_resolve_library",
        description: "Resolve a library name to its Context7-compatible library ID. Use this to find the correct library identifier before fetching docs.",
        parameters: {
          type: "object",
          properties: {
            libraryName: {
              type: "string",
              description: "The library or package name to search for (e.g., 'next.js', 'react', 'mongodb')",
            },
          },
          required: ["libraryName"],
        },
      },
    ];
  }

  async execute(toolCall: ToolCall, context?: any): Promise<ToolResult> {
    try {
      if (toolCall.name === "context7_get_docs") {
        const { library, topic, tokens = 5000, version } = toolCall.args || {};
        
        if (!library) {
          return {
            toolCallId: toolCall.id,
            name: toolCall.name,
            result: null,
            error: "Library parameter is required",
            success: false,
          };
        }

        // Use Next.js API route to proxy the request (avoids CORS)
        const params = new URLSearchParams();
        params.append("library", library);
        if (topic) {
          params.append("topic", topic);
        }
        if (tokens) {
          params.append("tokens", String(tokens));
        }
        if (version) {
          params.append("version", version);
        }

        const response = await fetch(`/api/context7/get-docs?${params.toString()}`, {
          headers: {
            "x-context7-api-key": this.apiKey,
          },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          return {
            toolCallId: toolCall.id,
            name: toolCall.name,
            result: null,
            error: errorData.error || `HTTP ${response.status}: ${response.statusText}`,
            success: false,
          };
        }

        const data = await response.json();
        return {
          toolCallId: toolCall.id,
          name: toolCall.name,
          result: data,
          success: true,
        };
      } else if (toolCall.name === "context7_resolve_library") {
        const { libraryName } = toolCall.args || {};
        
        if (!libraryName) {
          return {
            toolCallId: toolCall.id,
            name: toolCall.name,
            result: null,
            error: "libraryName parameter is required",
            success: false,
          };
        }

        // Try to use MCP tools directly if available (server-side)
        // Otherwise, use API route as fallback
        try {
          // Check if we're in an environment with MCP tools available
          // This would work if the toolset is running server-side with MCP access
          if (typeof (globalThis as any).mcp_context7_resolve_library_id === 'function') {
            const result = await (globalThis as any).mcp_context7_resolve_library_id({ libraryName });
            return {
              toolCallId: toolCall.id,
              name: toolCall.name,
              result: result,
              success: true,
            };
          }
        } catch (mcpError) {
          // MCP tools not available, fall back to API route
        }

        // Fallback: Use Next.js API route
        const params = new URLSearchParams();
        params.append("libraryName", libraryName);

        const response = await fetch(`/api/context7/resolve-library?${params.toString()}`, {
          headers: {
            "x-context7-api-key": this.apiKey,
          },
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          return {
            toolCallId: toolCall.id,
            name: toolCall.name,
            result: null,
            error: errorData.error || `HTTP ${response.status}: ${response.statusText}`,
            success: false,
          };
        }

        const data = await response.json();
        return {
          toolCallId: toolCall.id,
          name: toolCall.name,
          result: data,
          success: true,
        };
      }

      return {
        toolCallId: toolCall.id,
        name: toolCall.name,
        result: null,
        error: `Unknown tool: ${toolCall.name}`,
        success: false,
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

  hasTool(name: string): boolean {
    return name === "context7_get_docs" || name === "context7_resolve_library";
  }
}

