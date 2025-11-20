import { ToolExecutor } from "../types";
import { SandboxInterface } from "@codalyn/sandbox";
import { z } from "zod";

/**
 * Port list executor
 * List open ports in the sandbox
 */
export const portListExecutor: ToolExecutor = {
  async execute(params: any, sandbox: SandboxInterface) {
    try {
      const schema = z.object({});
      schema.parse(params);

      const ports = await sandbox.getPorts();

      return {
        success: true,
        output: {
          ports,
          count: ports.length,
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

