import { ToolExecutor } from "../types";
import { SandboxInterface } from "@codalyn/sandbox";
import { z } from "zod";

/**
 * Apply patch executor - apply targeted changes to files
 */
export const applyPatchExecutor: ToolExecutor = {
  async execute(params: any, sandbox: SandboxInterface) {
    try {
      const schema = z.object({
        path: z.string(),
        changes: z.array(
          z.object({
            startLine: z.number().optional(),
            endLine: z.number().optional(),
            newContent: z.string().optional(),
            find: z.string().optional(),
            replace: z.string().optional(),
            replaceAll: z.boolean().optional().default(false),
          })
        ),
      });
      const { path, changes } = schema.parse(params);

      let content = await sandbox.readFile(path);
      const lines = content.split("\n");

      for (const change of changes) {
        if (change.startLine !== undefined && change.endLine !== undefined && change.newContent !== undefined) {
          // Line-based replacement
          const start = change.startLine - 1; // Convert to 0-indexed
          const end = change.endLine;
          const newLines = change.newContent.split("\n");
          lines.splice(start, end - start, ...newLines);
          content = lines.join("\n");
        } else if (change.find !== undefined && change.replace !== undefined) {
          // Text-based find/replace
          if (change.replaceAll) {
            content = content.split(change.find).join(change.replace);
          } else {
            content = content.replace(change.find, change.replace);
          }
        } else {
          return {
            success: false,
            error: "Each change must have either (startLine, endLine, newContent) or (find, replace)",
          };
        }
      }

      await sandbox.writeFile(path, content);
      return { success: true, output: { path, changesApplied: changes.length } };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
};

