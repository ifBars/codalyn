import { ToolExecutor } from "../types";
import { SandboxInterface } from "@codalyn/sandbox";
import { z } from "zod";

/**
 * View plans executor
 * Lists all plan artifacts in the plans directory
 */
export const viewPlansExecutor: ToolExecutor = {
  async execute(params: any, sandbox: SandboxInterface) {
    try {
      const schema = z.object({
        limit: z.number().optional().default(10),
      });
      const { limit } = schema.parse(params);

      try {
        // Try to list markdown plan files using glob (sandbox.readdir returns string[] only)
        const planPaths = await sandbox.glob("plans/*.md").catch(() => []);
        const planFiles = planPaths.slice(0, limit);

        const plans = await Promise.all(
          planFiles.map(async (path) => {
            const filename = path.split("/").pop() || path;
            try {
              const content = await sandbox.readFile(path);
              const lines = content.split("\n");
              const titleMatch = content.match(/^#\s+(.+)$/m);
              const title = titleMatch ? titleMatch[1] : filename.replace(".md", "");
              const size = content.length;
              
              return {
                filename,
                path,
                title,
                size,
                preview: lines.slice(0, 5).join("\n").substring(0, 200),
              };
            } catch (error) {
              return {
                filename,
                path,
                title: filename.replace(".md", ""),
                error: error instanceof Error ? error.message : "Failed to read",
              };
            }
          })
        );

        return {
          success: true,
          output: {
            plans,
            count: plans.length,
            directory: "plans/",
          },
        };
      } catch (error) {
        // Plans directory doesn't exist yet
        return {
          success: true,
          output: {
            plans: [],
            count: 0,
            directory: "plans/",
            message: "No plans directory found. Plans will be created here when MDAP execution generates them.",
          },
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
};

