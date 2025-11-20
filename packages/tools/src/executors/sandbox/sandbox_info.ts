import { ToolExecutor } from "../types";
import { SandboxInterface } from "@codalyn/sandbox";
import { z } from "zod";

/**
 * Sandbox info executor
 * Get information about the sandbox
 */
export const sandboxInfoExecutor: ToolExecutor = {
  async execute(params: any, sandbox: SandboxInterface) {
    try {
      const schema = z.object({});
      schema.parse(params);

      const info = await sandbox.getInfo();
      const ports = await sandbox.getPorts();

      return {
        success: true,
        output: {
          ...info,
          ports,
          portCount: ports.length,
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

