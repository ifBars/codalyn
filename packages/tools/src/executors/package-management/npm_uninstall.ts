import { ToolExecutor } from "../types";
import { SandboxInterface } from "@codalyn/sandbox";
import { z } from "zod";

/**
 * NPM uninstall executor
 * Uninstall npm packages
 */
export const npmUninstallExecutor: ToolExecutor = {
  async execute(params: any, sandbox: SandboxInterface) {
    try {
      const schema = z.object({
        packages: z.array(z.string()),
      });
      const { packages } = schema.parse(params);

      if (packages.length === 0) {
        return {
          success: false,
          error: "No packages specified",
        };
      }

      const command = `npm uninstall ${packages.join(" ")}`;
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
          packages,
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

