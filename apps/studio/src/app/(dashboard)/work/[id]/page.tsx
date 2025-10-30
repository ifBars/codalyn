import { requireAuth } from "@/lib/auth";
import { getProject } from "@/server/actions/projects";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/lib/db";
import { aiSessions } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { Check } from "lucide-react";
import Chat from "@/components/work/chat";
import Preview from "@/components/work/preview";

export default async function WorkPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await requireAuth();
  const project = await getProject(params.id);

  if (!project || project.userId !== user.id) {
    redirect("/projects");
  }

  // Get or create latest session
  const latestSession = await db.query.aiSessions.findFirst({
    where: eq(aiSessions.projectId, project.id),
    orderBy: [desc(aiSessions.createdAt)],
  });

  return (
    <div className="flex h-full">
      {/* Left Sidebar - Chat & Updates */}
      <aside className="flex w-[420px] flex-col border-r border-white/10 bg-background/50">
        <div className="border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">{project.name}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Previewing last saved version
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading chat…</div>}>
            <Chat projectId={project.id} sessionId={latestSession?.id} />
          </Suspense>
        </div>
      </aside>

      {/* Right Main Area - Preview */}
      <main className="flex-1 overflow-hidden bg-background">
        <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-muted-foreground">Starting preview…</div>}>
          <Preview projectId={project.id} />
        </Suspense>
      </main>
    </div>
  );
}


