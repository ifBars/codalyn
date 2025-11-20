import { ToolExecutor } from "../types";
import { SandboxInterface } from "@codalyn/sandbox";
import { z } from "zod";

/**
 * Context7 get docs executor
 * Fetches library documentation from Context7 API
 */
export const context7GetDocsExecutor: ToolExecutor = {
  async execute(params: any, sandbox: SandboxInterface) {
    try {
      const schema = z.object({
        library: z.string(),
        topic: z.string().optional(),
        tokens: z.number().optional().default(5000),
        version: z.string().optional(),
      });
      const { library, topic, tokens, version } = schema.parse(params);

      // Try to use MCP tools if available (server-side with MCP access)
      try {
        if (typeof (globalThis as any).mcp_context7_get_library_docs === 'function') {
          const mcpParams: any = {
            context7CompatibleLibraryID: library.startsWith('/') ? library : `/${library}`,
          };
          if (topic) {
            mcpParams.topic = topic;
          }
          if (tokens) {
            mcpParams.tokens = tokens;
          }
          if (version) {
            mcpParams.version = version;
          }

          const result = await (globalThis as any).mcp_context7_get_library_docs(mcpParams);
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
        error: "context7_get_docs requires MCP tools access or client-side handling via Context7ToolSet. MCP tools are not available in the sandbox environment.",
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
};

