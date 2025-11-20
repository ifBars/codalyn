import { ToolExecutor } from "../types";
import { SandboxInterface } from "@codalyn/sandbox";
import { z } from "zod";

/**
 * Append to file executor
 */
export const appendToFileExecutor: ToolExecutor = {
  async execute(params: any, sandbox: SandboxInterface) {
    try {
      const schema = z.object({
        path: z.string(),
        content: z.string(),
        newline: z.boolean().optional().default(true),
      });
      const { path, content, newline } = schema.parse(params);

      let fileContent = await sandbox.readFile(path);
      if (newline && !fileContent.endsWith("\n")) {
        fileContent += "\n";
      }
      fileContent += content;

      await sandbox.writeFile(path, fileContent);
      return { success: true, output: { path } };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
};

