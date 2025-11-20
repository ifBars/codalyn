import { ToolExecutor } from "../types";
import { SandboxInterface } from "@codalyn/sandbox";
import { z } from "zod";

/**
 * Read environment variables executor
 * Reads environment variables from .env file
 */
export const envReadExecutor: ToolExecutor = {
  async execute(params: any, sandbox: SandboxInterface) {
    try {
      const schema = z.object({
        keys: z.array(z.string()).optional(),
      });
      const { keys } = schema.parse(params);

      // Try to read .env file
      let envVars: Record<string, string> = {};
      try {
        const envContent = await sandbox.readFile(".env");
        const lines = envContent.split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith("#")) {
            const match = trimmed.match(/^([^=]+)=(.*)$/);
            if (match) {
              const key = match[1].trim();
              const value = match[2].trim().replace(/^["']|["']$/g, ""); // Remove quotes
              envVars[key] = value;
            }
          }
        }
      } catch (error) {
        // .env file doesn't exist, return empty object
      }

      // Filter by keys if specified
      if (keys && keys.length > 0) {
        const filtered: Record<string, string> = {};
        for (const key of keys) {
          if (key in envVars) {
            filtered[key] = envVars[key];
          }
        }
        return {
          success: true,
          output: filtered,
        };
      }

      return {
        success: true,
        output: envVars,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
};

