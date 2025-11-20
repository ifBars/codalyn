import { ToolExecutor } from "../types";
import { SandboxInterface } from "@codalyn/sandbox";
import { z } from "zod";

/**
 * Get file info executor
 */
export const getFileInfoExecutor: ToolExecutor = {
  async execute(params: any, sandbox: SandboxInterface) {
    try {
      const schema = z.object({
        path: z.string(),
      });
      const { path } = schema.parse(params);

      // This would require stat() functionality from sandbox
      // For now, we can at least check if file exists by trying to read it
      const content = await sandbox.readFile(path);
      return {
        success: true,
        output: {
          path,
          size: content.length,
          exists: true,
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

