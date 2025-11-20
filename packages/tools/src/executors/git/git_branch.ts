import { ToolExecutor } from "../types";
import { SandboxInterface } from "@codalyn/sandbox";
import { z } from "zod";

/**
 * Git branch executor
 * List branches or create/checkout a branch
 */
export const gitBranchExecutor: ToolExecutor = {
  async execute(params: any, sandbox: SandboxInterface) {
    try {
      const schema = z.object({
        action: z.enum(["list", "create", "checkout"]),
        name: z.string().optional(),
      });
      const { action, name } = schema.parse(params);

      let command: string;
      if (action === "list") {
        command = "git branch -a";
      } else if (action === "create") {
        if (!name) {
          return {
            success: false,
            error: "Branch name is required for create action",
          };
        }
        command = `git branch ${name}`;
      } else {
        // checkout
        if (!name) {
          return {
            success: false,
            error: "Branch name is required for checkout action",
          };
        }
        command = `git checkout ${name}`;
      }

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

      const output = chunks.join("").trim();
      
      if (action === "list") {
        const branches = output
          ? output.split("\n").map(b => b.trim().replace(/^\*\s*/, "").replace(/^remotes\//, ""))
          : [];
        return {
          success: true,
          output: {
            branches,
            count: branches.length,
          },
        };
      }

      return {
        success: true,
        output: {
          action,
          branch: name,
          output,
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

