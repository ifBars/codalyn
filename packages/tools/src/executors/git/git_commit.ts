import { ToolExecutor } from "../types";
import { SandboxInterface } from "@codalyn/sandbox";
import { z } from "zod";

/**
 * Git commit executor
 * Create a git commit
 */
export const gitCommitExecutor: ToolExecutor = {
  async execute(params: any, sandbox: SandboxInterface) {
    try {
      const schema = z.object({
        message: z.string(),
        files: z.array(z.string()).optional(),
      });
      const { message, files } = schema.parse(params);

      // Stage files if specified
      if (files && files.length > 0) {
        const addCommand = `git add ${files.join(" ")}`;
        await sandbox.runCommand(addCommand, { timeout: 10000 });
      } else {
        // Stage all changes
        await sandbox.runCommand("git add -A", { timeout: 10000 });
      }

      // Create commit
      const escapedMessage = message.replace(/"/g, '\\"');
      const commitCommand = `git commit -m "${escapedMessage}"`;
      const process = await sandbox.runCommand(commitCommand, { timeout: 10000 });
      
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
          message,
          files: files || "all",
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

