"use server";

/**
 * Server actions for project management
 */

import { getUser, requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { createRepository, createGitHubClient } from "@/lib/github";

export async function createProject(data: { name: string; description?: string }) {
  const user = await requireAuth();

  const [project] = await db
    .insert(projects)
    .values({
      userId: user.id,
      name: data.name,
      description: data.description,
      status: "draft",
    })
    .returning();

  return project;
}

export async function updateProject(id: string, data: { name?: string; description?: string }) {
  const user = await requireAuth();

  const [project] = await db
    .update(projects)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, id))
    .returning();

  if (!project || project.userId !== user.id) {
    throw new Error("Project not found or unauthorized");
  }

  return project;
}

export async function deleteProject(id: string) {
  const user = await requireAuth();

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  });

  if (!project || project.userId !== user.id) {
    throw new Error("Project not found or unauthorized");
  }

  await db.delete(projects).where(eq(projects.id, id));
}

export async function getProject(id: string) {
  const user = await getUser();
  if (!user) return null;

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
  });

  if (!project || project.userId !== user.id) {
    return null;
  }

  return project;
}

export async function getUserProjects() {
  const user = await requireAuth();

  return await db.query.projects.findMany({
    where: eq(projects.userId, user.id),
    orderBy: (projects, { desc }) => [desc(projects.createdAt)],
  });
}

export async function initializeGitHubRepo(projectId: string, githubToken: string) {
  const user = await requireAuth();

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });

  if (!project || project.userId !== user.id) {
    throw new Error("Project not found or unauthorized");
  }

  if (project.githubRepoUrl) {
    return { url: project.githubRepoUrl };
  }

  const client = createGitHubClient(githubToken);
  const { url, fullName } = await createRepository(
    client,
    `codalyn-${project.name}`,
    project.description || undefined,
    false
  );

  await db
    .update(projects)
    .set({
      githubRepoUrl: url,
      githubRepoName: fullName,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, projectId));

  return { url, fullName };
}

