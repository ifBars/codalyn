import { ToolExecutor } from "../types";
import { SandboxInterface } from "@codalyn/sandbox";
import { z } from "zod";

/**
 * Copy path executor
 */
export const copyPathExecutor: ToolExecutor = {
  async execute(params: any, sandbox: SandboxInterface) {
    try {
      const schema = z.object({
        source: z.string(),
        destination: z.string(),
        recursive: z.boolean().optional().default(false),
      });
      const { source, destination } = schema.parse(params);

      const content = await sandbox.readFile(source);
      await sandbox.writeFile(destination, content);

      return { success: true, output: { source, destination } };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
};

