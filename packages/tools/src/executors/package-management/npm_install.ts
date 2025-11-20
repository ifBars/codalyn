import { ToolExecutor } from "../types";
import { SandboxInterface } from "@codalyn/sandbox";
import { z } from "zod";

/**
 * npm install executor
 */
export const npmInstallExecutor: ToolExecutor = {
  async execute(params: any, sandbox: SandboxInterface) {
    try {
      const schema = z.object({
        packages: z.array(z.string()),
        dev: z.boolean().optional().default(false),
      });
      const { packages, dev } = schema.parse(params);

      if (!packages || packages.length === 0) {
        return {
          success: false,
          error: "No packages specified for installation",
        };
      }

      // Check if sandbox supports installPackage method
      if ("installPackage" in sandbox && typeof sandbox.installPackage === "function") {
        // Use sandbox's installPackage method (preferred for WebContainer)
        const result = await sandbox.installPackage(packages, { dev });
        
        return {
          success: result.success,
          output: result.output || `Installed packages: ${packages.join(', ')}`,
          error: result.error,
        };
      }

      // Fallback to runCommand if installPackage is not available
      const command = `npm install ${dev ? '--save-dev' : '--save'} ${packages.join(' ')}`;
      const process = await sandbox.runCommand(command, { timeout: 120000 });
      
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

