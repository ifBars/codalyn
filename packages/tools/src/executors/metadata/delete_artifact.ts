import { ToolExecutor } from "../types";
import { SandboxInterface } from "@codalyn/sandbox";
import { z } from "zod";

/**
 * Delete artifact executor
 * Deletes an artifact (including plans) by path
 */
export const deleteArtifactExecutor: ToolExecutor = {
  async execute(params: any, sandbox: SandboxInterface) {
    try {
      const schema = z.object({
        path: z.string(),
      });
      const { path } = schema.parse(params);

      // Use the sandbox's deletePath method
      await sandbox.deletePath(path, { recursive: false });

      return {
        success: true,
        output: {
          path,
          deleted: true,
          message: `Artifact deleted: ${path}`,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        success: false,
        error: message.includes("Path not found")
          ? `Artifact not found: ${message}`
          : `Failed to delete artifact: ${message}`,
      };
    }
  },
};

