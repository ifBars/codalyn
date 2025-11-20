import { ToolExecutor } from "../types";
import { SandboxInterface } from "@codalyn/sandbox";
import { z } from "zod";

/**
 * Create directory executor
 */
export const createDirectoryExecutor: ToolExecutor = {
  async execute(params: any, sandbox: SandboxInterface) {
    try {
      const schema = z.object({
        path: z.string(),
      });
      const { path } = schema.parse(params);

      // Use sandbox's mkdir method directly
      await sandbox.mkdir(path, { recursive: true });

      return { success: true, output: { path } };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
};

