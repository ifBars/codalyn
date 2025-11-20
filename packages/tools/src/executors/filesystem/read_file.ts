import { ToolExecutor } from "../types";
import { chunkText } from "../utils";
import { SandboxInterface } from "@codalyn/sandbox";
import { z } from "zod";

/**
 * Read file executor with chunking support
 */
export const readFileExecutor: ToolExecutor = {
  async execute(params: any, sandbox: SandboxInterface) {
    try {
      const schema = z.object({
        path: z.string(),
        chunk: z.boolean().optional().default(false),
        chunkIndex: z.number().optional(),
        maxChunkSize: z.number().optional().default(1000),
      });
      const { path, chunk, chunkIndex, maxChunkSize } = schema.parse(params);
      
      const content = await sandbox.readFile(path);
      
      if (!chunk) {
        return { success: true, output: content };
      }

      // Chunk the content
      const chunks = chunkText(content, maxChunkSize);
      
      if (chunkIndex !== undefined) {
        if (chunkIndex < 0 || chunkIndex >= chunks.length) {
          return {
            success: false,
            error: `Chunk index ${chunkIndex} out of range. File has ${chunks.length} chunks.`,
          };
        }
        return {
          success: true,
          output: {
            chunk: chunks[chunkIndex],
            chunkIndex,
            totalChunks: chunks.length,
            path,
          },
        };
      }

      // Return all chunks
      return {
        success: true,
        output: {
          chunks,
          totalChunks: chunks.length,
          path,
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

