import { ToolExecutor } from "../types";
import { SandboxInterface } from "@codalyn/sandbox";
import { z } from "zod";

/**
 * Write environment variables executor
 * Writes environment variables to .env file
 */
export const envWriteExecutor: ToolExecutor = {
  async execute(params: any, sandbox: SandboxInterface) {
    try {
      const schema = z.object({
        variables: z.record(z.string()),
      });
      const { variables } = schema.parse(params);

      // Read existing .env file if it exists
      let existingEnv: Record<string, string> = {};
      try {
        const envContent = await sandbox.readFile(".env");
        // Parse existing .env file
        const lines = envContent.split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith("#")) {
            const match = trimmed.match(/^([^=]+)=(.*)$/);
            if (match) {
              const key = match[1].trim();
              const value = match[2].trim().replace(/^["']|["']$/g, ""); // Remove quotes
              existingEnv[key] = value;
            }
          }
        }
      } catch (error) {
        // .env file doesn't exist, start fresh
      }

      // Merge new variables with existing ones
      const mergedEnv = { ...existingEnv, ...variables };

      // Write back to .env file
      const envLines: string[] = [];
      for (const [key, value] of Object.entries(mergedEnv)) {
        // Escape special characters in value
        const escapedValue = value.includes(" ") || value.includes("=") || value.includes("#")
          ? `"${value.replace(/"/g, '\\"')}"`
          : value;
        envLines.push(`${key}=${escapedValue}`);
      }

      await sandbox.writeFile(".env", envLines.join("\n") + "\n");

      return {
        success: true,
        output: {
          written: Object.keys(variables),
          totalVariables: Object.keys(mergedEnv).length,
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

