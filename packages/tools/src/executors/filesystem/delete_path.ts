import { ToolExecutor } from "../types";
import { SandboxInterface } from "@codalyn/sandbox";
import { z } from "zod";

/**
 * Delete path executor
 * Delete a file or directory
 */
export const deletePathExecutor: ToolExecutor = {
  async execute(params: any, sandbox: SandboxInterface) {
    try {
      const schema = z.object({
        path: z.string(),
        recursive: z.boolean().optional().default(false),
      });
      const { path, recursive } = schema.parse(params);

      await sandbox.deletePath(path, { recursive });

      return {
        success: true,
        output: {
          path,
          deleted: true,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        error: message.includes("Path not found")
          ? message
          : message,
      };
    }
  },
};
