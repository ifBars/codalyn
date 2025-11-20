import { ToolExecutor } from "../types";
import { SandboxInterface } from "@codalyn/sandbox";
import { z } from "zod";

/**
 * Git revert executor
 * Revert changes to a file or commit
 */
export const gitRevertExecutor: ToolExecutor = {
  async execute(params: any, sandbox: SandboxInterface) {
    try {
      const schema = z.object({
        ref: z.string(),
      });
      const { ref } = schema.parse(params);

      // Check if ref looks like a commit hash (40 chars) or is a file path
      const isCommitHash = /^[a-f0-9]{7,40}$/i.test(ref);
      
      const command = isCommitHash 
        ? `git revert ${ref} --no-edit`
        : `git checkout HEAD -- ${ref}`;
      
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

      return {
        success: true,
        output: {
          ref,
          type: isCommitHash ? "commit" : "file",
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

