import { ToolExecutor } from "../types";
import { SandboxInterface } from "@codalyn/sandbox";
import { z } from "zod";

/**
 * Capture screenshot executor
 * This tool requires browser/DOM access and is handled client-side
 */
export const captureScreenshotExecutor: ToolExecutor = {
  async execute(params: any, sandbox: SandboxInterface) {
    try {
      const schema = z.object({});
      schema.parse(params); // Validate params (should be empty)
      
      // This executor requires browser/DOM access which is not available in the sandbox
      // The actual implementation is handled by BrowserToolSet on the client side
      return {
        success: false,
        error: "capture_screenshot requires browser/DOM access and is handled client-side by BrowserToolSet. This tool cannot be executed in the sandbox environment.",
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
};

