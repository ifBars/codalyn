import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { requireAuth } from "@/lib/auth";
import { createProject } from "@/server/actions/projects";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, GitBranch, Sparkles } from "lucide-react";

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireAuth();
  const params = await searchParams;
  const decodedError = params.error ? decodeURIComponent(params.error) : null;

  async function handleCreateProject(formData: FormData) {
    "use server";

    const name = formData.get("name") as string;
    const description = formData.get("description") as string;

    if (!name || name.trim().length === 0) {
      redirect(
        "/projects/new?error=" +
          encodeURIComponent("Project name is required")
      );
      return;
    }

    try {
      const project = await createProject({
        name: name.trim(),
        description: description?.trim() || undefined,
      });

      redirect(`/studio/${project.id}`);
    } catch (error) {
      redirect(
        "/projects/new?error=" +
          encodeURIComponent(
            error instanceof Error ? error.message : "Failed to create project"
          )
      );
    }
  }

  return (
    <div className="space-y-10">
      <div className="flex items-center gap-3">
        <Link
          href="/projects"
          className={cn(
            buttonVariants({ variant: "ghost", size: "sm" }),
            "gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm"
          )}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to projects
        </Link>
        <Badge variant="outline" className="rounded-full">
          Guided setup
        </Badge>
      </div>

    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-8 rounded-[32px] border border-white/8 bg-white/5 p-10 shadow-surface-lg">
          <div className="space-y-4 text-balance">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Let&apos;s bootstrap something ambitious
            </h1>
            <p className="max-w-2xl text-muted-foreground">
              Describe what you want to build. The AI planner will propose a
              scope, wire up Supabase, and share a diff for every change. You
              stay in the loop from brief to deployment.
            </p>
          </div>

          {decodedError && (
            <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-5 py-3 text-sm text-destructive">
              {decodedError}
            </div>
          )}

          <form action={handleCreateProject} className="space-y-8">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-3">
                <label className="text-sm font-medium tracking-wide text-muted-foreground">
                  Project name
                </label>
                <Input
                  type="text"
                  name="name"
                  placeholder="Codalyn Commerce, Marketing revamp..."
                  required
                />
                <p className="text-xs text-muted-foreground">
                  This appears in the studio, sandboxes, and Git commits.
                </p>
              </div>
              <div className="space-y-3">
                <label className="text-sm font-medium tracking-wide text-muted-foreground">
                  Repository (optional)
                </label>
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-muted-foreground">
                  <GitBranch className="h-4 w-4 text-primary" />
                  Connect a GitHub repo after creation to sync branches.
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-sm font-medium tracking-wide text-muted-foreground">
                What should we build?
              </label>
              <Textarea
                name="description"
                placeholder="Tell the agent about the product, target users, tech stack requirements, and any must-have features."
                rows={5}
              />
              <p className="text-xs text-muted-foreground">
                The more context you share, the sharper the plan. Paste specs,
                user stories, or link references.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <Button
                type="submit"
                size="lg"
                className="gap-2 rounded-full px-6"
              >
                <Sparkles className="h-5 w-5" />
                Create & start planning
              </Button>
              <Link
                href="/projects"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "rounded-full"
                )}
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>

        <aside className="space-y-4 rounded-[28px] border border-white/10 bg-white/[0.04] p-8 shadow-surface-lg">
          <p className="text-xs uppercase tracking-[0.32em] text-muted-foreground">
            What you get
          </p>
          <ul className="space-y-4 text-sm text-muted-foreground">
            {[
              "AI planning session that outlines the roadmap before writing code.",
              "Live Monaco editor with synced file tree and diff previews.",
              "Integrated terminal, Supabase workflows, and deployment helpers.",
            ].map((item) => (
              <li
                key={item}
                className="flex items-start gap-3 rounded-2xl border border-white/5 bg-white/5 px-4 py-3"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}

