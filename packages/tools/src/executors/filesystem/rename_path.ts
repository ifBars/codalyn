import { ToolExecutor } from "../types";
import { SandboxInterface } from "@codalyn/sandbox";
import { z } from "zod";

/**
 * Rename path executor
 */
export const renamePathExecutor: ToolExecutor = {
  async execute(params: any, sandbox: SandboxInterface) {
    try {
      const schema = z.object({
        oldPath: z.string(),
        newPath: z.string(),
      });
      const { oldPath, newPath } = schema.parse(params);

      // Read the old file, write to new location, delete old
      const content = await sandbox.readFile(oldPath);
      await sandbox.writeFile(newPath, content);
      await sandbox.deletePath(oldPath);

      return { success: true, output: { oldPath, newPath } };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
};

