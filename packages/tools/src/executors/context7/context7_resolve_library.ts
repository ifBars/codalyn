import { ToolExecutor } from "../types";
import { SandboxInterface } from "@codalyn/sandbox";
import { z } from "zod";

/**
 * Context7 resolve library executor
 * Resolves a library name to its Context7-compatible library ID
 */
export const context7ResolveLibraryExecutor: ToolExecutor = {
  async execute(params: any, sandbox: SandboxInterface) {
    try {
      const schema = z.object({
        libraryName: z.string(),
      });
      const { libraryName } = schema.parse(params);

      // Try to use MCP tools if available (server-side with MCP access)
      try {
        if (typeof (globalThis as any).mcp_context7_resolve_library_id === 'function') {
          const result = await (globalThis as any).mcp_context7_resolve_library_id({ libraryName });
          return {
            success: true,
            output: result,
          };
        }
      } catch (mcpError) {
        // MCP tools not available, continue to fallback
      }

      // Fallback: This tool requires MCP access or client-side handling
      // The actual implementation is handled by Context7ToolSet on the client side
      return {
        success: false,
        error: "context7_resolve_library requires MCP tools access or client-side handling via Context7ToolSet. MCP tools are not available in the sandbox environment.",
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
};

