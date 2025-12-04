import { ToolExecutor } from "../types";
import { SandboxInterface } from "@codalyn/sandbox";
import { z } from "zod";

/**
 * Get console logs executor
 * Retrieves console logs and errors from the sandbox
 */
export const getConsoleLogsExecutor: ToolExecutor = {
  async execute(params: any, sandbox: SandboxInterface) {
    try {
      const schema = z.object({
        limit: z.number().int().positive().optional(),
        level: z.enum(['all', 'error', 'warn', 'info']).optional(),
        since: z.number().int().positive().optional(),
      });
      
      const validatedParams = schema.parse(params);

      const logs = await sandbox.getConsoleLogs({
        limit: validatedParams.limit,
        level: validatedParams.level,
        since: validatedParams.since,
      });

      return {
        success: true,
        output: {
          logs,
          count: logs.length,
          filtered: {
            limit: validatedParams.limit ?? 50,
            level: validatedParams.level ?? 'all',
            since: validatedParams.since,
          },
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

