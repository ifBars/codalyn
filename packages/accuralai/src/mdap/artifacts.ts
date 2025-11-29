/**
 * Artifact Management for MDAP
 * Artifacts represent files, plans, and outputs generated during agent execution
 */

import { z } from 'zod';
import { nanoid } from 'nanoid';

/**
 * Artifact types supported by the system
 */
export type ArtifactType =
  | 'plan'           // Markdown planning documents
  | 'code'           // Code files (ts, tsx, js, jsx, etc.)
  | 'markdown'       // General markdown documentation
  | 'json'           // JSON data files
  | 'image'          // Images (base64 encoded)
  | 'text'           // Plain text files
  | 'other';         // Other file types

/**
 * Artifact metadata
 */
export interface ArtifactMetadata {
  /** Agent that created/modified this artifact */
  agentId?: string;
  /** Agent role that created/modified this artifact */
  agentRole?: string;
  /** Timestamp when artifact was created */
  createdAt?: Date;
  /** Timestamp when artifact was last modified */
  updatedAt?: Date;
  /** Task ID that generated this artifact */
  taskId?: string;
  /** Description of the artifact */
  description?: string;
  /** Tags for categorization */
  tags?: string[];
  /** Custom metadata */
  custom?: Record<string, unknown>;
}

/**
 * Core Artifact interface
 */
export interface Artifact {
  /** Unique identifier for the artifact */
  id: string;
  /** Filename with extension */
  filename: string;
  /** File path (relative to project root) */
  path: string;
  /** Content of the artifact */
  content: string;
  /** MIME type or file type indicator */
  mimeType: string;
  /** Semantic artifact type */
  type: ArtifactType;
  /** Metadata about the artifact */
  metadata: ArtifactMetadata;
  /** Version number (incremented on updates) */
  version: number;
}

/**
 * Zod schema for artifact validation
 */
export const ArtifactSchema = z.object({
  id: z.string().default(() => nanoid()),
  filename: z.string().min(1),
  path: z.string().min(1),
  content: z.string(),
  mimeType: z.string(),
  type: z.enum(['plan', 'code', 'markdown', 'json', 'image', 'text', 'other']),
  metadata: z.object({
    agentId: z.string().optional(),
    agentRole: z.string().optional(),
    createdAt: z.date().optional(),
    updatedAt: z.date().optional(),
    taskId: z.string().optional(),
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
    custom: z.record(z.unknown()).optional(),
  }).default({}),
  version: z.number().int().nonnegative().default(1),
});

/**
 * Artifact registry to track all artifacts in a workflow
 */
export class ArtifactRegistry {
  private artifacts: Map<string, Artifact> = new Map();

  /**
   * Add or update an artifact
   * If artifact with same path exists, it will be versioned
   */
  addOrUpdate(artifact: Partial<Artifact> & { filename: string; content: string }): Artifact {
    const path = artifact.path || artifact.filename;
    const existing = this.getByPath(path);

    const newArtifact: Artifact = ArtifactSchema.parse({
      id: existing?.id || artifact.id || nanoid(),
      filename: artifact.filename,
      path,
      content: artifact.content,
      mimeType: artifact.mimeType || this.inferMimeType(artifact.filename),
      type: artifact.type || this.inferArtifactType(artifact.filename, path),
      metadata: {
        ...existing?.metadata,
        ...artifact.metadata,
        createdAt: existing?.metadata.createdAt || new Date(),
        updatedAt: new Date(),
      },
      version: existing ? existing.version + 1 : 1,
    });

    this.artifacts.set(newArtifact.id, newArtifact);
    return newArtifact;
  }

  /**
   * Get artifact by ID
   */
  get(id: string): Artifact | undefined {
    return this.artifacts.get(id);
  }

  /**
   * Get artifact by path
   */
  getByPath(path: string): Artifact | undefined {
    return Array.from(this.artifacts.values()).find(a => a.path === path);
  }

  /**
   * Get all artifacts
   */
  getAll(): Artifact[] {
    return Array.from(this.artifacts.values());
  }

  /**
   * Get artifacts by type
   */
  getByType(type: ArtifactType): Artifact[] {
    return this.getAll().filter(a => a.type === type);
  }

  /**
   * Get all plan artifacts (markdown files in plans directory)
   */
  getPlans(): Artifact[] {
    return this.getAll().filter(a => a.type === 'plan' || a.path.startsWith('plans/'));
  }

  /**
   * Get artifacts created by a specific agent
   */
  getByAgent(agentId: string): Artifact[] {
    return this.getAll().filter(a => a.metadata.agentId === agentId);
  }

  /**
   * Delete an artifact
   */
  delete(id: string): boolean {
    return this.artifacts.delete(id);
  }

  /**
   * Clear all artifacts
   */
  clear(): void {
    this.artifacts.clear();
  }

  /**
   * Get artifact count
   */
  count(): number {
    return this.artifacts.size;
  }

  /**
   * Infer MIME type from filename
   */
  private inferMimeType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      'md': 'text/markdown',
      'ts': 'text/typescript',
      'tsx': 'text/typescript',
      'js': 'text/javascript',
      'jsx': 'text/javascript',
      'json': 'application/json',
      'html': 'text/html',
      'css': 'text/css',
      'txt': 'text/plain',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'gif': 'image/gif',
      'svg': 'image/svg+xml',
    };
    return mimeTypes[ext || ''] || 'application/octet-stream';
  }

  /**
   * Infer artifact type from filename and path
   */
  private inferArtifactType(filename: string, path: string): ArtifactType {
    // Check if it's in the plans directory
    if (path.startsWith('plans/') || path.startsWith('/plans/')) {
      return 'plan';
    }

    const ext = filename.split('.').pop()?.toLowerCase();

    // Code files
    if (['ts', 'tsx', 'js', 'jsx', 'py', 'java', 'c', 'cpp', 'go', 'rs'].includes(ext || '')) {
      return 'code';
    }

    // Markdown
    if (ext === 'md') {
      return 'markdown';
    }

    // JSON
    if (ext === 'json') {
      return 'json';
    }

    // Images
    if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext || '')) {
      return 'image';
    }

    // Plain text
    if (ext === 'txt') {
      return 'text';
    }

    return 'other';
  }
}

/**
 * Helper functions for creating artifacts
 */
export const ArtifactHelpers = {
  /**
   * Create a plan artifact (markdown file in plans directory)
   */
  createPlan(config: {
    filename: string;
    content: string;
    description?: string;
    agentId?: string;
    agentRole?: string;
    taskId?: string;
  }): Partial<Artifact> & { filename: string; content: string } {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const filename = config.filename.endsWith('.md') ? config.filename : `${config.filename}.md`;

    return {
      filename,
      path: `plans/${timestamp}-${filename}`,
      content: config.content,
      type: 'plan',
      mimeType: 'text/markdown',
      metadata: {
        description: config.description,
        agentId: config.agentId,
        agentRole: config.agentRole,
        taskId: config.taskId,
        tags: ['plan', 'mdap'],
        createdAt: new Date(),
      },
    };
  },

  /**
   * Create a code artifact
   */
  createCode(config: {
    filename: string;
    path?: string;
    content: string;
    description?: string;
    agentId?: string;
    agentRole?: string;
  }): Partial<Artifact> & { filename: string; content: string } {
    return {
      filename: config.filename,
      path: config.path || config.filename,
      content: config.content,
      type: 'code',
      metadata: {
        description: config.description,
        agentId: config.agentId,
        agentRole: config.agentRole,
        tags: ['code'],
        createdAt: new Date(),
      },
    };
  },

  /**
   * Format plan content as markdown
   */
  formatPlanMarkdown(plan: {
    title: string;
    objective: string;
    strategy: string;
    tasks: Array<{ id: string; agentRole: string; description: string; complexity?: string }>;
    timestamp?: Date;
  }): string {
    const timestamp = plan.timestamp || new Date();

    return `# ${plan.title}

**Generated:** ${timestamp.toISOString()}

## Objective

${plan.objective}

## Strategy

${plan.strategy}

## Task Breakdown

${plan.tasks.map((task, i) => `
### ${i + 1}. ${task.agentRole}

- **Task ID:** \`${task.id}\`
- **Description:** ${task.description}
${task.complexity ? `- **Complexity:** ${task.complexity}` : ''}
`).join('\n')}

---

*This plan was generated by the MDAP orchestrator and will be executed by specialized sub-agents.*
`;
  },
};

/**
 * Create an artifact registry
 */
export function createArtifactRegistry(): ArtifactRegistry {
  return new ArtifactRegistry();
}
