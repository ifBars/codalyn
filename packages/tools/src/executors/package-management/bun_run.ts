import { ToolExecutor } from "../types";
import { SandboxInterface } from "@codalyn/sandbox";
import { z } from "zod";

/**
 * Bun run executor - restricted to safe scripts
 */
export const bunRunExecutor: ToolExecutor = {
  async execute(params: any, sandbox: SandboxInterface) {
    try {
      const schema = z.object({
        script: z.string(),
        args: z.array(z.string()).optional().default([]),
        workspace: z.string().optional(),
        filter: z.string().optional(),
      });
      const { script, args, workspace, filter } = schema.parse(params);

      // Block dangerous scripts that might break the agent workflow
      const blockedScripts = ["dev", "start", "serve"];
      if (blockedScripts.includes(script.toLowerCase())) {
        return {
          success: false,
          error: `Cannot run '${script}' script - dev servers are managed automatically and should not be started manually.`,
        };
      }

      // Build command
      let command = "bun run";
      if (filter) {
        command += ` --filter="${filter}"`;
      } else if (workspace) {
        command += ` --workspace ${workspace}`;
      }
      command += ` ${script}`;
      if (args && args.length > 0) {
        command += ` ${args.join(" ")}`;
      }

      const process = await sandbox.runCommand(command, { timeout: 60000 });
      
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
          script,
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

