import { ToolExecutor } from "../types";
import { SandboxInterface } from "@codalyn/sandbox";
import { z } from "zod";

/**
 * Read lines executor
 */
export const readLinesExecutor: ToolExecutor = {
  async execute(params: any, sandbox: SandboxInterface) {
    try {
      const schema = z.object({
        path: z.string(),
        startLine: z.number(),
        endLine: z.number().optional(),
      });
      const { path, startLine, endLine } = schema.parse(params);

      const content = await sandbox.readFile(path);
      const lines = content.split("\n");

      const start = startLine - 1; // Convert to 0-indexed
      const end = endLine ? endLine : lines.length;

      const selectedLines = lines.slice(start, end);

      return {
        success: true,
        output: {
          lines: selectedLines,
          content: selectedLines.join("\n"),
          startLine,
          endLine: end,
          totalLines: lines.length,
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

