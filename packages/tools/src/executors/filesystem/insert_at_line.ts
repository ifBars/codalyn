import { ToolExecutor } from "../types";
import { SandboxInterface } from "@codalyn/sandbox";
import { z } from "zod";

/**
 * Insert at line executor
 */
export const insertAtLineExecutor: ToolExecutor = {
  async execute(params: any, sandbox: SandboxInterface) {
    try {
      const schema = z.object({
        path: z.string(),
        line: z.number(),
        content: z.string(),
      });
      const { path, line, content } = schema.parse(params);

      const fileContent = await sandbox.readFile(path);
      const lines = fileContent.split("\n");

      if (line === 0) {
        lines.unshift(content);
      } else if (line === -1) {
        lines.push(content);
      } else {
        lines.splice(line - 1, 0, content);
      }

      await sandbox.writeFile(path, lines.join("\n"));
      return { success: true, output: { path, line } };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
};

