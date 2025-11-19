import { requireAuth } from "@/lib/auth";
import { getProject } from "@/server/actions/projects";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/lib/db";
import { aiSessions } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { Check } from "lucide-react";
import WorkPageClient from "./work-page-client";

export default async function WorkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAuth();
  const { id } = await params;
  const project = await getProject(id);

  if (!project || project.userId !== user.id) {
    redirect("/projects");
  }

  // Get or create latest session
  const latestSession = await db.query.aiSessions.findFirst({
    where: eq(aiSessions.projectId, project.id),
    orderBy: [desc(aiSessions.createdAt)],
  });

  return (
    <WorkPageClient 
      projectId={project.id} 
      projectName={project.name}
      sessionId={latestSession?.id} 
    />
  );
}


