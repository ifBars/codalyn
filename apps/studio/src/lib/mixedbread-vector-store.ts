"use client";

import Client from "@mixedbread/sdk";
import type { SearchResult } from "./vector-store";

/**
 * Mixedbread Vector Store implementation using @mixedbread/sdk
 * Provides cloud-based semantic search with reranking
 */
export class MixedbreadVectorStore {
  private client: Client;
  private storeId: string | null = null;
  private storeName: string;
  private projectFiles: Record<string, string> = {};
  private fileHashes: Map<string, string> = new Map(); // path -> content hash for caching
  private uploadedFiles: Set<string> = new Set(); // Track uploaded files

  constructor(apiKey: string, storeName?: string, projectId?: string) {
    this.client = new Client({ apiKey });
    // Use provided store name, or generate one from projectId, or default to 'mgrep'
    this.storeName = storeName || (projectId ? `mgrep-${projectId}` : "mgrep");
  }

  /**
   * Generate a simple hash for content comparison
   */
  private hashContent(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Ensure store exists, create if it doesn't
   */
  async ensureStore(): Promise<string> {
    if (this.storeId) {
      return this.storeId;
    }

    try {
      // Try to retrieve store by name first
      try {
        const store = await this.client.stores.retrieve(this.storeName);
        if (!store.id) {
          throw new Error("Store ID is null");
        }
        this.storeId = store.id;
        return this.storeId;
      } catch (error: any) {
        // Store doesn't exist, create it
        if (error?.status === 404 || error?.response?.status === 404) {
          const newStore = await this.client.stores.create({
            name: this.storeName,
            description: `Codalyn project store: ${this.storeName}`,
          });
          if (!newStore.id) {
            throw new Error("Failed to create store: ID is null");
          }
          this.storeId = newStore.id;
          return this.storeId;
        }
        throw error;
      }
    } catch (error) {
      console.error("Error ensuring Mixedbread store:", error);
      throw error;
    }
  }

  /**
   * Set project files (without indexing them immediately)
   */
  setProjectFiles(files: Record<string, string>): void {
    this.projectFiles = files;
    // Clear tracking for files that no longer exist
    for (const path of this.uploadedFiles) {
      if (!files[path]) {
        this.uploadedFiles.delete(path);
        this.fileHashes.delete(path);
      }
    }
  }

  /**
   * Index a file (upload to Mixedbread store)
   * Only uploads if content has changed (based on hash)
   */
  async indexFile(path: string, content: string): Promise<void> {
    // Check if file content has changed
    const contentHash = this.hashContent(content);
    const existingHash = this.fileHashes.get(path);

    // Skip if content hasn't changed and already uploaded
    if (existingHash === contentHash && this.uploadedFiles.has(path)) {
      return;
    }

    try {
      await this.ensureStore();

      if (!this.storeId) {
        throw new Error("Store ID not available");
      }

      // Create a File-like object from content
      const blob = new Blob([content], { type: "text/plain" });
      const file = new File([blob], path.split("/").pop() || "file", {
        type: this.getContentType(path),
      });

      // Upload file to Mixedbread store
      await this.client.stores.files.upload(this.storeId, file, {
        external_id: path,
        overwrite: true,
        metadata: {
          path,
          content_type: this.getContentType(path),
        },
      });

      this.fileHashes.set(path, contentHash);
      this.uploadedFiles.add(path);
    } catch (error) {
      console.error(`Error indexing file ${path} to Mixedbread:`, error);
      throw error;
    }
  }

  /**
   * Get content type based on file extension
   */
  private getContentType(path: string): string {
    const ext = path.split(".").pop()?.toLowerCase();
    const contentTypes: Record<string, string> = {
      ts: "text/typescript",
      tsx: "text/typescript",
      js: "text/javascript",
      jsx: "text/javascript",
      json: "application/json",
      md: "text/markdown",
      css: "text/css",
      html: "text/html",
      txt: "text/plain",
    };
    return contentTypes[ext || ""] || "text/plain";
  }

  /**
   * Index all files in the project
   */
  async indexProject(files: Record<string, string>): Promise<void> {
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

  /**
   * Remove a file from the store
   */
  async removeFile(path: string): Promise<void> {
    try {
      if (!this.storeId) {
        await this.ensureStore();
      }

      if (!this.storeId) {
        return;
      }

      // Delete file by external_id
      await this.client.stores.files.delete(path, {
        store_identifier: this.storeId,
      });

      this.uploadedFiles.delete(path);
      this.fileHashes.delete(path);
    } catch (error: any) {
      // Ignore 404 errors (file might not exist)
      if (error?.status !== 404 && error?.response?.status !== 404) {
        console.error(`Error removing file ${path} from Mixedbread:`, error);
        throw error;
      }
    }
  }

  /**
   * Update a file in the store
   */
  async updateFile(path: string, content: string): Promise<void> {
    // Update is same as re-indexing (overwrite: true handles it)
    await this.indexFile(path, content);
  }

  /**
   * Search for similar content using Mixedbread API
   * Lazily indexes project files if not already indexed
   */
  async search(query: string, limit: number = 5): Promise<SearchResult[]> {
    // Lazy indexing: if we have project files but haven't indexed them yet, index them now
    if (Object.keys(this.projectFiles).length > 0 && this.uploadedFiles.size === 0) {
      console.log("Lazy indexing project files to Mixedbread store...");
      await this.indexProject(this.projectFiles);
    }

    try {
      await this.ensureStore();

      if (!this.storeId) {
        throw new Error("Store ID not available");
      }

      // Search with reranking enabled
      const response = await this.client.stores.search({
        query,
        store_identifiers: [this.storeId],
        top_k: limit,
        search_options: {
          rerank: true, // Enable reranking for better results
        },
      });

      // Map Mixedbread results to SearchResult format
      const results: SearchResult[] = (response.data || []).map((item: any, index: number) => {
        // Extract path from metadata or external_id
        const path = item.metadata?.path || item.external_id || "";
        
        // Extract content - Mixedbread returns chunks, so we need to get the content
        const content = item.content || item.text || "";

        return {
          path,
          chunkIndex: index, // Mixedbread handles chunking internally
          content,
          score: item.score || item.relevance_score || 0,
          metadata: {
            ...item.metadata,
            mixedbread_id: item.id,
          },
        };
      });

      return results;
    } catch (error) {
      console.error("Error searching Mixedbread store:", error);
      throw error;
    }
  }

  /**
   * Get all indexed file paths
   */
  getIndexedFiles(): string[] {
    return Array.from(this.uploadedFiles);
  }

  /**
   * Check if a file is indexed
   */
  isIndexed(path: string): boolean {
    return this.uploadedFiles.has(path);
  }
}

