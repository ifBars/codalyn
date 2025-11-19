"use client";

import { GoogleGenAI } from "@google/genai";

export interface EmbeddingVector {
  values: number[];
  tokenCount?: number;
}

export interface ChunkedContent {
  path: string;
  chunkIndex: number;
  content: string;
  embedding?: EmbeddingVector;
  metadata?: Record<string, any>;
}

/**
 * Embedding service using Gemini embedding model
 */
export class EmbeddingService {
  private ai: GoogleGenAI;
  private model: string = "models/embedding-001";

  constructor(apiKey: string) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  /**
   * Generate embeddings for text content
   */
  async embedContent(
    content: string,
    taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY" = "RETRIEVAL_DOCUMENT"
  ): Promise<EmbeddingVector> {
    try {
      const response = await this.ai.models.embedContent({
        model: this.model,
        contents: content,
        config: {
          taskType,
        },
      });

      return {
        values: response.embeddings?.[0]?.values || [],
      };
    } catch (error) {
      console.error("Error generating embedding:", error);
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple content chunks
   */
  async embedBatch(
    contents: string[],
    taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY" = "RETRIEVAL_DOCUMENT"
  ): Promise<EmbeddingVector[]> {
    // Process in batches to avoid rate limits
    const batchSize = 10;
    const results: EmbeddingVector[] = [];

    for (let i = 0; i < contents.length; i += batchSize) {
      const batch = contents.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((content) => this.embedContent(content, taskType))
      );
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error("Embeddings must have the same dimension");
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }
}

/**
 * Chunk text content for embedding
 * Exported for use in other modules
 */
export function chunkText(
  content: string,
  maxChunkSize: number = 1000,
  overlap: number = 200
): string[] {
  const chunks: string[] = [];

  // Split by lines first to preserve context
  const lines = content.split("\n");
  let currentChunk = "";

  for (const line of lines) {
    // If adding this line would exceed max size, save current chunk
    if (currentChunk.length + line.length > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim());

      // Start new chunk with overlap from previous chunk
      const overlapText = currentChunk.slice(-overlap);
      currentChunk = overlapText + "\n" + line;
    } else {
      currentChunk += (currentChunk ? "\n" : "") + line;
    }
  }

  // Add remaining chunk
  if (currentChunk.trim().length > 0) {
    chunks.push(currentChunk.trim());
  }

  return chunks.length > 0 ? chunks : [content];
}

