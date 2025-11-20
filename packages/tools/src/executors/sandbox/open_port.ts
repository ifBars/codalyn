import { ToolExecutor } from "../types";
import { SandboxInterface } from "@codalyn/sandbox";
import { z } from "zod";

/**
 * Open port executor
 * Open a port for access
 */
export const openPortExecutor: ToolExecutor = {
  async execute(params: any, sandbox: SandboxInterface) {
    try {
      const schema = z.object({
        port: z.number(),
        protocol: z.enum(["http", "https"]).optional().default("http"),
      });
      const { port, protocol } = schema.parse(params);

      await sandbox.openPort(port, protocol);

      return {
        success: true,
        output: {
          port,
          protocol,
          opened: true,
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

