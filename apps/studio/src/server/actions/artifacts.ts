"use server";

/**
 * Server actions for MDAP artifact management
 */

import { getUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { artifacts, projects } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import type { Artifact } from "@codalyn/accuralai";

/**
 * Save an MDAP artifact to the database
 */
export async function saveArtifact(
  projectId: string,
  artifact: Artifact,
  sessionId?: string
) {
  const user = await getUser();
  if (!user) throw new Error("Unauthorized");

  // Verify project ownership
  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, user.id)),
  });

  if (!project) throw new Error("Project not found or unauthorized");

  // Check if artifact already exists
  const existing = await db.query.artifacts.findFirst({
    where: and(
      eq(artifacts.projectId, projectId),
      eq(artifacts.artifactId, artifact.id)
    ),
  });

  if (existing) {
    // Update existing artifact
    const [updated] = await db
      .update(artifacts)
      .set({
        content: artifact.content,
        metadata: artifact.metadata as any,
        version: artifact.version.toString(),
        updatedAt: new Date(),
      })
      .where(eq(artifacts.id, existing.id))
      .returning();

    return updated;
  } else {
    // Insert new artifact
    const [inserted] = await db
      .insert(artifacts)
      .values({
        projectId,
        sessionId: sessionId || null,
        artifactId: artifact.id,
        filename: artifact.filename,
        path: artifact.path,
        content: artifact.content,
        mimeType: artifact.mimeType,
        type: artifact.type,
        metadata: artifact.metadata as any,
        version: artifact.version.toString(),
      })
      .returning();

    return inserted;
  }
}

/**
 * Save multiple artifacts in a batch
 */
export async function saveArtifacts(
  projectId: string,
  artifactList: Artifact[],
  sessionId?: string
) {
  const savedArtifacts = [];

  for (const artifact of artifactList) {
    const saved = await saveArtifact(projectId, artifact, sessionId);
    savedArtifacts.push(saved);
  }

  return savedArtifacts;
}

/**
 * Get all artifacts for a project
 */
export async function getProjectArtifacts(projectId: string) {
  const user = await getUser();
  if (!user) throw new Error("Unauthorized");

  // Verify project ownership
  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, user.id)),
  });

  if (!project) throw new Error("Project not found or unauthorized");

  const projectArtifacts = await db.query.artifacts.findMany({
    where: eq(artifacts.projectId, projectId),
    orderBy: [desc(artifacts.createdAt)],
  });

  return projectArtifacts;
}

/**
 * Get all plan artifacts for a project
 */
export async function getProjectPlans(projectId: string) {
  const user = await getUser();
  if (!user) throw new Error("Unauthorized");

  // Verify project ownership
  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, projectId), eq(projects.userId, user.id)),
  });

  if (!project) throw new Error("Project not found or unauthorized");

  const planArtifacts = await db.query.artifacts.findMany({
    where: and(eq(artifacts.projectId, projectId), eq(artifacts.type, "plan")),
    orderBy: [desc(artifacts.createdAt)],
  });

  return planArtifacts;
}

/**
 * Get artifacts for a specific session
 */
export async function getSessionArtifacts(sessionId: string) {
  const user = await getUser();
  if (!user) throw new Error("Unauthorized");

  const sessionArtifacts = await db.query.artifacts.findMany({
    where: eq(artifacts.sessionId, sessionId),
    orderBy: [desc(artifacts.createdAt)],
  });

  return sessionArtifacts;
}

/**
 * Convert database artifact to MDAP Artifact type
 */
export function dbArtifactToMdap(dbArtifact: any): Artifact {
  return {
    id: dbArtifact.artifactId,
    filename: dbArtifact.filename,
    path: dbArtifact.path,
    content: dbArtifact.content,
    mimeType: dbArtifact.mimeType,
    type: dbArtifact.type,
    metadata: {
      ...dbArtifact.metadata,
      createdAt: dbArtifact.metadata?.createdAt
        ? new Date(dbArtifact.metadata.createdAt)
        : new Date(dbArtifact.createdAt),
      updatedAt: dbArtifact.metadata?.updatedAt
        ? new Date(dbArtifact.metadata.updatedAt)
        : new Date(dbArtifact.updatedAt),
    },
    version: parseInt(dbArtifact.version, 10),
  };
}

/**
 * Get project plans as MDAP Artifact objects
 */
export async function getProjectPlansAsMdap(projectId: string): Promise<Artifact[]> {
  const plans = await getProjectPlans(projectId);
  return plans.map(dbArtifactToMdap);
}
