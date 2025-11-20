import { ToolExecutor } from "../types";
import { SandboxInterface } from "@codalyn/sandbox";
import { z } from "zod";

/**
 * Git push executor
 * Push commits to remote repository
 */
export const gitPushExecutor: ToolExecutor = {
  async execute(params: any, sandbox: SandboxInterface) {
    try {
      const schema = z.object({
        branch: z.string().optional(),
        remote: z.string().optional().default("origin"),
      });
      const { branch, remote } = schema.parse(params);

      const command = branch 
        ? `git push ${remote} ${branch}`
        : `git push ${remote}`;
      
      const process = await sandbox.runCommand(command, { timeout: 30000 });
      
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

      return {
        success: true,
        output: {
          remote,
          branch: branch || "current",
          output: chunks.join(""),
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

