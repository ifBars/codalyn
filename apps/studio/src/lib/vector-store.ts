"use client";

import { EmbeddingService, ChunkedContent, EmbeddingVector, chunkText } from "./embeddings";
import { WebContainerManager } from "./webcontainer-manager";

export interface SearchResult {
  path: string;
  chunkIndex: number;
  content: string;
  score: number;
  metadata?: Record<string, any>;
}

/**
 * Vector store for project files with lazy indexing and caching
 * Files are only indexed when search is actually used, not on project load
 */
export class VectorStore {
  private embeddingService: EmbeddingService;
  private chunks: Map<string, ChunkedContent[]> = new Map(); // path -> chunks
  private embeddings: Map<string, EmbeddingVector[]> = new Map(); // path -> embeddings
  private isIndexing: boolean = false;
  private indexQueue: Set<string> = new Set();
  private projectFiles: Record<string, string> = {}; // Store project files for lazy indexing
  private fileHashes: Map<string, string> = new Map(); // path -> content hash for caching

  constructor(apiKey: string) {
    this.embeddingService = new EmbeddingService(apiKey);
  }

  /**
   * Set project files (without indexing them immediately)
   * This allows lazy indexing when search is actually used
   */
  setProjectFiles(files: Record<string, string>): void {
    this.projectFiles = files;
    // Clear index for files that no longer exist
    for (const path of this.chunks.keys()) {
      if (!files[path]) {
        this.removeFile(path);
      }
    }
  }

  /**
   * Generate a simple hash for content comparison
   */
  private hashContent(content: string): string {
    // Simple hash function - good enough for detecting changes
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Index a file (chunk and embed)
   * Only indexes if content has changed (based on hash)
   */
  async indexFile(path: string, content: string): Promise<void> {
    // Check if file content has changed
    const contentHash = this.hashContent(content);
    const existingHash = this.fileHashes.get(path);
    
    // Skip if content hasn't changed and already indexed
    if (existingHash === contentHash && this.chunks.has(path)) {
      return;
    }

    // Add to queue if already indexing
    if (this.isIndexing) {
      this.indexQueue.add(path);
      return;
    }

    this.isIndexing = true;

    try {
      // Chunk the content
      const chunks = chunkText(content);

      // Generate embeddings for chunks
      const embeddings = await this.embeddingService.embedBatch(chunks, "RETRIEVAL_DOCUMENT");

      // Store chunks and embeddings
      const chunkedContents: ChunkedContent[] = chunks.map((chunk, index) => ({
        path,
        chunkIndex: index,
        content: chunk,
        embedding: embeddings[index],
        metadata: {
          path,
          chunkIndex: index,
          totalChunks: chunks.length,
        },
      }));

      this.chunks.set(path, chunkedContents);
      this.embeddings.set(path, embeddings);
      this.fileHashes.set(path, contentHash);

      // Process queue
      await this.processQueue();
    } catch (error) {
      console.error(`Error indexing file ${path}:`, error);
      throw error;
    } finally {
      this.isIndexing = false;
    }
  }

  /**
   * Process queued files
   */
  private async processQueue(): Promise<void> {
    if (this.indexQueue.size === 0) return;

    const queue = Array.from(this.indexQueue);
    this.indexQueue.clear();

    for (const path of queue) {
      try {
        const content = await WebContainerManager.readFile(path);
        await this.indexFile(path, content);
      } catch (error) {
        console.error(`Error processing queued file ${path}:`, error);
      }
    }
  }

  /**
   * Remove a file from the index
   */
  removeFile(path: string): void {
    this.chunks.delete(path);
    this.embeddings.delete(path);
    this.fileHashes.delete(path);
  }

  /**
   * Update a file in the index
   * Only updates if the file is already indexed (lazy indexing)
   */
  async updateFile(path: string, content: string): Promise<void> {
    // Only update if already indexed - otherwise it will be indexed lazily when search is used
    if (this.isIndexed(path)) {
      await this.indexFile(path, content);
    }
    // Update project files reference for lazy indexing
    if (this.projectFiles[path] !== undefined) {
      this.projectFiles[path] = content;
    }
  }

  /**
   * Search for similar content using embeddings
   * Lazily indexes project files if not already indexed
   */
  async search(query: string, limit: number = 5): Promise<SearchResult[]> {
    // Lazy indexing: if we have project files but haven't indexed them yet, index them now
    if (Object.keys(this.projectFiles).length > 0 && this.chunks.size === 0) {
      console.log("Lazy indexing project files for search...");
      await this.indexProject(this.projectFiles);
    }

    // Generate query embedding
    const queryEmbedding = await this.embeddingService.embedContent(query, "RETRIEVAL_QUERY");

    // Calculate similarity scores for all chunks
    const results: SearchResult[] = [];

    for (const [path, chunks] of this.chunks.entries()) {
      const embeddings = this.embeddings.get(path) || [];

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = embeddings[i];

        if (embedding) {
          const score = this.embeddingService.cosineSimilarity(
            queryEmbedding.values,
            embedding.values
          );

          results.push({
            path: chunk.path,
            chunkIndex: chunk.chunkIndex,
            content: chunk.content,
            score,
            metadata: chunk.metadata,
          });
        }
      }
    }

    // Sort by score (descending) and return top results
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .filter((r) => r.score > 0.3); // Filter out very low similarity
  }

  /**
   * Get all indexed file paths
   */
  getIndexedFiles(): string[] {
    return Array.from(this.chunks.keys());
  }

  /**
   * Check if a file is indexed
   */
  isIndexed(path: string): boolean {
    return this.chunks.has(path);
  }

  /**
   * Index all files in the project (async, lazy-loaded when search is used)
   */
  async indexProject(files: Record<string, string>): Promise<void> {
    // Store files for lazy indexing
    this.setProjectFiles(files);
    
    const paths = Object.keys(files);
    
    // Process in batches to avoid overwhelming the API
    const batchSize = 5;
    for (let i = 0; i < paths.length; i += batchSize) {
      const batch = paths.slice(i, i + batchSize);
      await Promise.all(
        batch.map((path) => this.indexFile(path, files[path]))
      );
    }
  }
}

