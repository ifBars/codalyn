import { ToolExecutor } from "../types";
import { SandboxInterface } from "@codalyn/sandbox";

/**
 * Search project executor (requires vector store - will be implemented in client)
 */
export const searchProjectExecutor: ToolExecutor = {
  async execute(params: any, sandbox: SandboxInterface) {
    // This executor will be handled by the client-side vector store
    // For now, return an error indicating it needs client-side implementation
    return {
      success: false,
      error: "search_project requires client-side vector store. This tool is handled automatically by the AI client.",
    };
  },
};

