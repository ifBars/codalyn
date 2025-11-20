import { ToolExecutor } from "../types";
import { SandboxInterface } from "@codalyn/sandbox";
import { z } from "zod";

/**
 * Git checkout executor
 * Checkout a branch or file
 */
export const gitCheckoutExecutor: ToolExecutor = {
  async execute(params: any, sandbox: SandboxInterface) {
    try {
      const schema = z.object({
        ref: z.string(),
      });
      const { ref } = schema.parse(params);

      const command = `git checkout ${ref}`;
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

