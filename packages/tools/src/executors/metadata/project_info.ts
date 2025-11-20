import { ToolExecutor } from "../types";
import { SandboxInterface } from "@codalyn/sandbox";
import { z } from "zod";

/**
 * Get project info executor
 * Returns project metadata and configuration
 */
export const projectInfoExecutor: ToolExecutor = {
  async execute(params: any, sandbox: SandboxInterface) {
    try {
      const schema = z.object({});
      schema.parse(params);

      const info: Record<string, any> = {
        sandbox: await sandbox.getInfo(),
      };

      // Try to read package.json
      try {
        const packageJson = await sandbox.readFile("package.json");
        const pkg = JSON.parse(packageJson);
        info.name = pkg.name;
        info.version = pkg.version;
        info.scripts = pkg.scripts || {};
        info.dependencies = pkg.dependencies || {};
        info.devDependencies = pkg.devDependencies || {};
      } catch (error) {
        // package.json doesn't exist
      }

      // Try to read tsconfig.json
      try {
        const tsconfig = await sandbox.readFile("tsconfig.json");
        const config = JSON.parse(tsconfig);
        info.typescript = {
          compilerOptions: config.compilerOptions || {},
        };
      } catch (error) {
        // tsconfig.json doesn't exist
      }

      // List root directory files
      try {
        const rootFiles = await sandbox.readdir(".");
        info.rootFiles = rootFiles;
      } catch (error) {
        info.rootFiles = [];
      }

      return {
        success: true,
        output: info,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
};

