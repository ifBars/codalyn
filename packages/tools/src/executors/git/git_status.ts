import { ToolExecutor } from "../types";
import { SandboxInterface } from "@codalyn/sandbox";
import { z } from "zod";

/**
 * Git status executor
 * Get git status information
 */
export const gitStatusExecutor: ToolExecutor = {
  async execute(params: any, sandbox: SandboxInterface) {
    try {
      const schema = z.object({});
      schema.parse(params);

      const process = await sandbox.runCommand("git status --porcelain", { timeout: 10000 });
      
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

      const output = chunks.join("").trim();
      const lines = output ? output.split("\n") : [];
      
      const files = lines.map(line => {
        const status = line.substring(0, 2);
        const file = line.substring(3);
        return { status, file };
      });

      return {
        success: true,
        output: {
          files,
          count: files.length,
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

