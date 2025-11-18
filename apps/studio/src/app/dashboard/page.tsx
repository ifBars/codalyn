"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import {
  ArrowRight,
  FolderPlus,
  HardDrive,
  Layers3,
  Loader2,
  Sparkles,
  Trash2,
} from "lucide-react";

import {
  StoredProject,
  createProject,
  deleteProject,
  listProjects,
  setActiveProjectId,
} from "@/lib/project-storage";

const formatDate = (value?: string) => {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
};

export default function DashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<StoredProject[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setFormError("Name your project so you can find it again.");
      return;
    }
    setIsSubmitting(true);
    try {
      const project = createProject({ name, description, instructions });
      setName("");
      setDescription("");
      setInstructions("");
      setFormError(null);
      refresh();
      router.push(`/builder?projectId=${project.id}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = (id: string) => {
    // eslint-disable-next-line no-alert
    const confirmed = window.confirm("Delete this project from local storage?");
    if (!confirmed) return;
    deleteProject(id);
    refresh();
  };

  const hasProjects = projects.length > 0;

  return (
    <div className="flex min-h-screen flex-col px-4 py-10 sm:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="rounded-[32px] border border-white/10 bg-white/5 p-8 shadow-surface-lg">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3 text-balance">
              <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.4em] text-muted-foreground">
                <Layers3 className="h-4 w-4" /> Projects
              </span>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Organize your AI builds in one local dashboard
              </h1>
              <p className="text-sm text-muted-foreground">
                Projects, prompts, Gemini API keys, and source files never leave your browser. Reopen sandboxes anytime or clone components into your repo.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              <Link
                href="/builder"
                className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-5 py-2 font-semibold text-primary"
              >
                Jump to builder <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-2 text-foreground"
              >
                View landing
              </Link>
            </div>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-6 rounded-[28px] border border-white/10 bg-white/5 p-6"
          >
            <div>
              <p className="text-sm font-semibold">Create a new project</p>
              <p className="text-xs text-muted-foreground">
                We prefill your WebContainer workspace with the default Vite + React scaffold.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Marketing site redesign"
                className="w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                Description
              </label>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Landing for our AI-native analytics product"
                className="w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none"
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                Prompt or instructions
              </label>
              <textarea
                value={instructions}
                onChange={(event) => setInstructions(event.target.value)}
                placeholder="Dark hero, metrics grid, CTA, light/dark toggle"
                className="w-full rounded-2xl border border-white/15 bg-black/30 px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none"
                rows={3}
              />
            </div>
            {formError && <p className="text-sm text-red-400">{formError}</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Creating…
                </>
              ) : (
                <>
                  <FolderPlus className="h-4 w-4" /> Create project
                </>
              )}
            </button>
          </form>

          <div className="space-y-4">
            <div className="rounded-[28px] border border-white/10 bg-white/5 p-5">
              <h2 className="text-lg font-semibold">Stored locally</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {projects.length} project{projects.length === 1 ? "" : "s"} saved in this browser. Clearing localStorage will remove them.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <Stat icon={Sparkles} label="Prompts replayable" value="Yes" />
                <Stat icon={HardDrive} label="Storage" value="localStorage" />
                <Stat icon={Layers3} label="WebContainers" value="Live" />
              </div>
            </div>

            {hasProjects ? (
              <div className="space-y-4">
                {projects.map((project) => (
                  <div
                    key={project.id}
                    className="rounded-[24px] border border-white/10 bg-black/30 p-5"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-xl font-semibold text-foreground">
                          {project.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Updated {formatDate(project.updatedAt)} · Last opened {formatDate(project.lastOpenedAt)}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-3 text-sm">
                        <button
                          onClick={() => handleDelete(project.id)}
                          className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-muted-foreground transition hover:border-red-200 hover:text-red-300"
                        >
                          <Trash2 className="h-4 w-4" /> Remove
                        </button>
                        <Link
                          href={`/builder?projectId=${project.id}`}
                          onClick={() => setActiveProjectId(project.id)}
                          className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-4 py-2 font-semibold text-primary"
                        >
                          Continue <ArrowRight className="h-4 w-4" />
                        </Link>
                      </div>
                    </div>
                    {project.description && (
                      <p className="mt-3 text-sm text-muted-foreground">{project.description}</p>
                    )}
                    {project.instructions && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Prompt: {project.instructions}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-muted-foreground font-mono">
                      ID: {project.id}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 rounded-[28px] border border-dashed border-white/20 bg-black/30 px-6 py-12 text-center">
                <p className="text-xl font-semibold text-foreground">No projects yet</p>
                <p className="text-sm text-muted-foreground">
                  Kick off your first build by creating a project above. We'll seed it with a working Vite + React app inside WebContainers, ready for AI edits.
                </p>
                <Link
                  href="/builder"
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-2 text-sm font-semibold text-foreground"
                >
                  See the builder <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Sparkles;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
      <Icon className="h-5 w-5 text-primary" />
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold text-foreground">{value}</p>
      </div>
    </div>
  );
}
