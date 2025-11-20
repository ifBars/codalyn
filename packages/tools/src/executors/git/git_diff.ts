import { ToolExecutor } from "../types";
import { SandboxInterface } from "@codalyn/sandbox";
import { z } from "zod";

/**
 * Git diff executor
 * Get git diff for staged or unstaged changes
 */
export const gitDiffExecutor: ToolExecutor = {
  async execute(params: any, sandbox: SandboxInterface) {
    try {
      const schema = z.object({
        staged: z.boolean().optional().default(false),
      });
      const { staged } = schema.parse(params);

      const command = staged ? "git diff --cached" : "git diff";
      const process = await sandbox.runCommand(command, { timeout: 10000 });
      
      // Read output
      const reader = process.output.getReader();
      const chunks: string[] = [];
      let done = false;
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          chunks.push(value);
        }
      }

      const diff = chunks.join("");

      return {
        success: true,
        output: {
          staged,
          diff: diff || "No changes",
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

