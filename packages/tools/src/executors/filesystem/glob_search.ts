import { ToolExecutor } from "../types";
import { SandboxInterface } from "@codalyn/sandbox";
import { z } from "zod";

/**
 * Glob search executor
 * Search for files matching a glob pattern
 */
export const globSearchExecutor: ToolExecutor = {
  async execute(params: any, sandbox: SandboxInterface) {
    try {
      const schema = z.object({
        pattern: z.string(),
      });
      const { pattern } = schema.parse(params);

      const matches = await sandbox.glob(pattern);

      return {
        success: true,
        output: {
          pattern,
          matches,
          count: matches.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
};

