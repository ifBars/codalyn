import { ToolExecutor } from "../types";
import { SandboxInterface } from "@codalyn/sandbox";
import { z } from "zod";

/**
 * List directory executor
 */
export const listDirectoryExecutor: ToolExecutor = {
  async execute(params: any, sandbox: SandboxInterface) {
    try {
      const schema = z.object({ path: z.string().optional() });
      const { path = "." } = schema.parse(params);
      const entries = await sandbox.readdir(path);
      return { success: true, output: entries };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
};

