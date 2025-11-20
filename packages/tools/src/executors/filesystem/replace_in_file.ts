import { ToolExecutor } from "../types";
import { SandboxInterface } from "@codalyn/sandbox";
import { z } from "zod";

/**
 * Replace in file executor
 */
export const replaceInFileExecutor: ToolExecutor = {
  async execute(params: any, sandbox: SandboxInterface) {
    try {
      const schema = z.object({
        path: z.string(),
        find: z.string(),
        replace: z.string(),
        replaceAll: z.boolean().optional().default(true),
        regex: z.boolean().optional().default(false),
        caseSensitive: z.boolean().optional().default(true),
      });
      const { path, find, replace, replaceAll, regex, caseSensitive } = schema.parse(params);

      let content = await sandbox.readFile(path);

      if (regex) {
        const flags = (replaceAll ? "g" : "") + (caseSensitive ? "" : "i");
        const pattern = new RegExp(find, flags);
        content = content.replace(pattern, replace);
      } else {
        if (replaceAll) {
          if (caseSensitive) {
            content = content.split(find).join(replace);
          } else {
            const pattern = new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
            content = content.replace(pattern, replace);
          }
        } else {
          if (caseSensitive) {
            content = content.replace(find, replace);
          } else {
            const pattern = new RegExp(find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
            content = content.replace(pattern, replace);
          }
        }
      }

      await sandbox.writeFile(path, content);
      return { success: true, output: { path } };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
};

