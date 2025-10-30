export type ProjectStatus = "draft" | "generating" | "ready" | "error";

export interface Project {
  id: string;
  userId: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  githubRepoUrl?: string;
  githubRepoName?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  image?: string;
  githubAccessToken?: string;
  createdAt: Date;
}

export interface Deployment {
  id: string;
  projectId: string;
  vercelUrl?: string;
  status: "pending" | "deployed" | "failed";
  deployedAt?: Date;
  createdAt: Date;
}

export interface TelemetryEvent {
  id: string;
  userId: string;
  projectId?: string;
  event: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

