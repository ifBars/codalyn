"use client";

import { useRef, useEffect, useState } from "react";
import { Suspense } from "react";
import { Check, FileText, Code2, Folder } from "lucide-react";
import Chat, { ChatHandle } from "@/components/work/chat";
import Preview from "@/components/work/preview";
import { PlansViewer } from "@/components/work/plans-viewer";
import { getProjectById } from "@/lib/project-storage";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Artifact } from "@codalyn/accuralai";

interface WorkPageClientProps {
  projectId: string;
  projectName: string | null;
  sessionId?: string;
}

type ViewMode = "chat" | "plans" | "files";

export default function WorkPageClient({
  projectId,
  projectName: initialProjectName,
  sessionId
}: WorkPageClientProps) {
  const chatRef = useRef<ChatHandle>(null);
  const router = useRouter();
  const [projectName, setProjectName] = useState(initialProjectName);
  const [viewMode, setViewMode] = useState<ViewMode>("chat");
  const [plans, setPlans] = useState<Artifact[]>([]);
  const [currentPlan, setCurrentPlan] = useState<Artifact | null>(null);

  useEffect(() => {
    // If projectName wasn't provided by the server (non-authenticated user),
    // load it from localStorage
    if (!initialProjectName) {
      const project = getProjectById(projectId);
      if (project) {
        setProjectName(project.name);
      } else {
        // Project doesn't exist, redirect to projects page
        router.push("/projects");
      }
    }
  }, [projectId, initialProjectName, router]);

  const handleRequestFix = (errors: string) => {
    if (chatRef.current) {
      chatRef.current.sendMessage(errors);
    }
  };

  const handleNewPlan = (plan: Artifact) => {
    setPlans(prev => [plan, ...prev]);
    setCurrentPlan(plan);
  };

  const handleNewArtifacts = (artifacts: Artifact[]) => {
    const planArtifacts = artifacts.filter(a => a.type === "plan");
    if (planArtifacts.length > 0) {
      setPlans(prev => [...planArtifacts, ...prev]);
      setCurrentPlan(planArtifacts[0]);
    }
  };

  return (
    <div className="flex h-full">
      {/* Left Sidebar - Chat, Plans, Files */}
      <aside className="flex w-[420px] flex-col border-r border-white/10 bg-background/50">
        {/* Header with Project Name */}
        <div className="border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">{projectName || "Loading..."}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Previewing last saved version
          </p>
        </div>

        {/* View Mode Tabs */}
        <div className="border-b border-white/10">
          <div className="flex">
            <button
              onClick={() => setViewMode("chat")}
              className={cn(
                "flex-1 px-4 py-2.5 text-xs font-medium transition-colors",
                "border-b-2",
                viewMode === "chat"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="flex items-center justify-center gap-1.5">
                <Code2 className="h-3.5 w-3.5" />
                <span>Chat</span>
              </div>
            </button>
            <button
              onClick={() => setViewMode("plans")}
              className={cn(
                "flex-1 px-4 py-2.5 text-xs font-medium transition-colors",
                "border-b-2",
                viewMode === "plans"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="flex items-center justify-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                <span>Plans</span>
                {plans.length > 0 && (
                  <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-xs text-primary">
                    {plans.length}
                  </span>
                )}
              </div>
            </button>
            <button
              onClick={() => setViewMode("files")}
              className={cn(
                "flex-1 px-4 py-2.5 text-xs font-medium transition-colors",
                "border-b-2",
                viewMode === "files"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="flex items-center justify-center gap-1.5">
                <Folder className="h-3.5 w-3.5" />
                <span>Files</span>
              </div>
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto">
          {viewMode === "chat" && (
            <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading chat…</div>}>
              <Chat
                ref={chatRef}
                projectId={projectId}
                sessionId={sessionId}
                onNewPlan={handleNewPlan}
                onNewArtifacts={handleNewArtifacts}
              />
            </Suspense>
          )}

          {viewMode === "plans" && (
            <PlansViewer
              plans={plans}
              currentPlan={currentPlan}
              onSelectPlan={setCurrentPlan}
              compact={true}
            />
          )}

          {viewMode === "files" && (
            <div className="flex h-full items-center justify-center p-8">
              <div className="text-center text-muted-foreground">
                <Folder className="mx-auto h-12 w-12 text-muted-foreground/30" />
                <h3 className="mt-4 text-sm font-medium">File Explorer</h3>
                <p className="mt-2 text-xs">Coming soon</p>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Right Main Area - Preview */}
      <main className="flex-1 overflow-hidden bg-background">
        <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-muted-foreground">Starting preview…</div>}>
          <Preview projectId={projectId} onRequestFix={handleRequestFix} />
        </Suspense>
      </main>
    </div>
  );
}

