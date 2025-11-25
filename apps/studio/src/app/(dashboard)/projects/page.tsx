"use client";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { ProjectGrid } from "@/components/dashboard/ProjectGrid";
import { useEffect, useState } from "react";
import { StoredProject, listProjects } from "@/lib/project-storage";

type StatusKey = "draft" | "generating" | "ready" | "error" | string;

const statusMeta: Record<
  StatusKey,
  { label: string; badge: "default" | "accent" | "success" | "warning" | "outline" | "info" }
> = {
  draft: { label: "Draft", badge: "outline" },
  generating: { label: "Generating", badge: "accent" },
  ready: { label: "Ready", badge: "success" },
  error: { label: "Needs attention", badge: "warning" },
};

function formatDate(input?: Date | null) {
  if (!input) return "—";
  try {
    return new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
    }).format(input);
  } catch {
    return "—";
  }
}

export default function DashboardPage() {
  const [projects, setProjects] = useState<StoredProject[]>([]);

  const refresh = () => setProjects(listProjects());

  useEffect(() => {
    refresh();
    if (typeof window === "undefined") return;
    const handler = (event: StorageEvent) => {
      if (!event.key || event.key === "codalyn.projects.v1") {
        refresh();
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const mappedProjects = projects.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    status: "ready", // Local projects are always ready
    updatedAt: new Date(p.updatedAt),
    githubRepoUrl: null,
  }));

  const generatingCount = 0; // Local projects don't have generating status
  const readyCount = projects.length;

  return (
    <div className="space-y-8">
      <section className="rounded-[32px] border border-white/5 bg-white/5 p-8 shadow-surface-lg backdrop-blur-xl md:p-10">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-4">
            <Badge variant="info" className="w-fit uppercase tracking-widest">
              Projects
            </Badge>
            <div className="space-y-3 text-balance">
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Shape ideas into production-grade products
              </h1>
              <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">
                Each project spins up an isolated sandbox, AI session history,
                and deployment pipeline. Pick up exactly where you left off—diffs,
                terminal logs, and previews are always one click away.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/projects/new"
              className={cn(buttonVariants({ size: "lg" }), "gap-2 rounded-full")}
            >
              <Sparkles className="h-5 w-5" />
              New project
            </Link>
          </div>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total projects"
            value={mappedProjects.length}
            detail="Tracked across your workspace"
          />
          <StatCard
            label="Ready to ship"
            value={readyCount}
            detail="Tested and approved for release"
          />
          <StatCard
            label="Currently generating"
            value={generatingCount}
            detail="Agents preparing new changes"
          />
          <StatCard
            label="Sandboxes"
            value={`${mappedProjects.length} / ∞`}
            detail="Provisioned on demand"
          />
        </div>
      </section>

      <ProjectGrid projects={mappedProjects} onRefresh={refresh} />
    </div>
  );
}

function StatCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="rounded-3xl border border-white/5 bg-white/[0.02] px-6 py-5 shadow-surface-lg transition-all hover:bg-white/[0.04]">
      <p className="text-xs uppercase tracking-[0.32em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-3 text-3xl font-semibold">{value}</p>
      <p className="mt-3 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

