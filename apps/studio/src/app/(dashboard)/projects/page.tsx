import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getUserProjects } from "@/server/actions/projects";
import {
  ArrowUpRight,
  GitBranch,
  LayoutDashboard,
  Sparkles,
  TimerReset,
} from "lucide-react";
import Link from "next/link";

type StatusKey = "draft" | "generating" | "ready" | "error" | string;

const statusMeta: Record<
  StatusKey,
  { label: string; badge: "default" | "accent" | "success" | "warning" | "outline" | "destructive" }
> = {
  draft: { label: "Draft", badge: "outline" },
  generating: { label: "Generating", badge: "accent" },
  ready: { label: "Ready", badge: "success" },
  error: { label: "Needs attention", badge: "destructive" },
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

export default async function DashboardPage() {
  const projects = await getUserProjects();

  const generatingCount = projects.filter(
    (project) => project.status === "generating"
  ).length;
  const readyCount = projects.filter(
    (project) => project.status === "ready"
  ).length;

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
            <Link
              href="/projects"
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "gap-2 rounded-full"
              )}
            >
              <LayoutDashboard className="h-5 w-5" />
              View dashboard
            </Link>
          </div>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total projects"
            value={projects.length}
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
            value={`${projects.length} / ∞`}
            detail="Provisioned on demand"
          />
        </div>
      </section>

      {projects.length === 0 ? (
        <div className="glass-panel flex flex-col items-center justify-center gap-6 rounded-[28px] border border-dashed border-white/20 px-8 py-16 text-center">
          <span className="rounded-full border border-white/15 bg-white/10 px-4 py-1 text-xs uppercase tracking-[0.4em] text-muted-foreground">
            Getting started
          </span>
          <div className="space-y-4 text-balance">
            <h2 className="text-2xl font-semibold">
              Your first project is minutes away
            </h2>
            <p className="max-w-md text-sm text-muted-foreground">
              Bring a problem statement or spec. Codalyn will draft a plan,
              propose diffs, and let you preview each change before it applies.
            </p>
          </div>
          <Link
            href="/projects/new"
            className={cn(buttonVariants({ size: "lg" }), "gap-2 rounded-full")}
          >
            <Sparkles className="h-5 w-5" />
            Create your first project
          </Link>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => {
            const status = statusMeta[project.status as StatusKey] ?? {
              label: project.status,
              badge: "outline",
            };

            return (
              <Link
                key={project.id}
                href={`/work/${project.id}`}
                className="group relative overflow-hidden rounded-[26px] border border-white/10 bg-white/[0.04] p-6 transition duration-200 hover:border-white/30 hover:bg-white/10"
              >
                <div className="absolute inset-x-6 top-6 flex items-center justify-between">
                  <Badge variant={status.badge}>{status.label}</Badge>
                  <ArrowUpRight className="h-5 w-5 text-muted-foreground transition duration-200 group-hover:text-primary" />
                </div>

                <div className="pt-12">
                  <h3 className="text-xl font-semibold tracking-tight">
                    {project.name}
                  </h3>
                  {project.description ? (
                    <p className="mt-2 text-sm text-muted-foreground line-clamp-3">
                      {project.description}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">
                      No description yet—click to start a spec or prompt.
                    </p>
                  )}
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
                    <TimerReset className="h-3.5 w-3.5" />
                    Updated {formatDate(project.updatedAt)}
                  </div>
                  {project.githubRepoUrl && (
                    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
                      <GitBranch className="h-3.5 w-3.5" />
                      Connected to GitHub
                    </div>
                  )}
                  <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 font-mono">
                    ID: {project.id.slice(0, 8)}…
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
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
    <div className="rounded-3xl border border-white/10 bg-white/[0.06] px-6 py-5 shadow-surface-lg">
      <p className="text-xs uppercase tracking-[0.32em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-3 text-3xl font-semibold">{value}</p>
      <p className="mt-3 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

