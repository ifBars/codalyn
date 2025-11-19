import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { getProject } from "@/server/actions/projects";
import type { LucideIcon } from "lucide-react";
import {
  Bot,
  CalendarClock,
  Diff,
  FileCode2,
  Files,
  GitPullRequest,
  MessagesSquare,
  PlayCircle,
  TerminalSquare,
  Timer,
  Wand2,
} from "lucide-react";
import { redirect } from "next/navigation";
import { ReactNode } from "react";

type StatusKey = "draft" | "generating" | "ready" | "error" | string;

const statusMeta: Record<
  StatusKey,
  { label: string; badge: "default" | "accent" | "success" | "warning" | "outline"; blurb: string }
> = {
  draft: {
    label: "Draft",
    badge: "outline",
    blurb: "Project initialized. Kick off the first planning session.",
  },
  generating: {
    label: "Generating",
    badge: "accent",
    blurb: "Agent is mapping tasks and composing code changes.",
  },
  ready: {
    label: "Ready",
    badge: "success",
    blurb: "Diffs approved and applied. Run QA or ship a deployment.",
  },
  error: {
    label: "Needs attention",
    badge: "warning",
    blurb: "Last run raised errors. Review logs to resolve.",
  },
};

const chatMessages = [
  {
    role: "assistant" as const,
    content:
      "I analysed the brief and propose starting with a Supabase auth scaffold, then wiring the pricing page.",
    timestamp: "2m ago",
  },
  {
    role: "user" as const,
    content:
      "Sounds good. Prioritize the marketing site with CTA hero and product grid. Keep code split by feature.",
    timestamp: "Just now",
  },
  {
    role: "assistant" as const,
    content:
      "Great. I’ll draft Tailwind sections, configure global theme tokens, and prep a diff for review.",
    timestamp: "Just now",
  },
];

const timelineEvents = [
  {
    title: "Project created",
    detail: "Imported spec and seeded Supabase schema.",
    time: "5m ago",
  },
  {
    title: "AI planning",
    detail: "Agent outlining flows and dependencies.",
    time: "2m ago",
  },
  {
    title: "Diff proposed",
    detail: "3 files changed · Awaiting your approval",
    time: "Pending",
  },
];

const diffFiles = [
  {
    path: "apps/studio/src/app/(dashboard)/studio/[id]/page.tsx",
    summary: "+142 -8 · Studio workspace layout",
    status: "pending",
  },
  {
    path: "apps/studio/src/components/workbench/chat-panel.tsx",
    summary: "+1 new file",
    status: "new",
  },
  {
    path: "apps/studio/src/server/actions/ai.ts",
    summary: "+34 -4 · Streaming tool execution",
    status: "pending",
  },
];

const fileTree = [
  {
    section: "app",
    items: [
      "page.tsx",
      "layout.tsx",
      "globals.css",
      "studio/[id]/page.tsx",
      "projects/page.tsx",
    ],
  },
  {
    section: "components",
    items: [
      "workbench/chat-panel.tsx",
      "workbench/file-tree.tsx",
      "ui/button.tsx",
      "ui/card.tsx",
    ],
  },
  {
    section: "server/actions",
    items: ["ai.ts", "projects.ts"],
  },
];

export default async function StudioPage({
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

  const status =
    statusMeta[project.status as StatusKey] ??
    statusMeta.draft ??
    ({
      label: project.status,
      badge: "outline",
      blurb: "Project initialized. Kick off the first planning session.",
    } as const);

  const createdAt =
    project.createdAt instanceof Date
      ? new Intl.DateTimeFormat("en", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "numeric",
        }).format(project.createdAt)
      : "—";

  return (
    <div className="space-y-8">
      <section className="rounded-[32px] border border-white/5 bg-white/[0.05] p-8 shadow-surface-lg backdrop-blur-xl lg:p-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant={status.badge}>{status.label}</Badge>
              <span className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
                Project workspace
              </span>
            </div>
            <div className="space-y-3 text-balance">
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                {project.name}
              </h1>
              <p className="max-w-2xl text-muted-foreground">
                {project.description ||
                  "Add your product goals so the AI planner can generate the right roadmap, migrations, and UI flows."}
              </p>
            </div>
            <p className="text-sm text-muted-foreground">{status.blurb}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" className="rounded-full border-white/20">
              <GitPullRequest className="mr-2 h-4 w-4" />
              Review staged diffs
            </Button>
            <Button className="rounded-full">
              <Wand2 className="mr-2 h-5 w-5" />
              Start AI session
            </Button>
          </div>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <InfoTile
            title="Project ID"
            detail={<span className="font-mono text-sm">{project.id}</span>}
            icon={Files}
          />
          <InfoTile
            title="Created"
            detail={createdAt}
            icon={CalendarClock}
          />
          <InfoTile
            title="Active status"
            detail={status.label}
            icon={Timer}
          />
          <InfoTile
            title="Repository"
            detail={
              project.githubRepoUrl ? (
                <a
                  href={project.githubRepoUrl}
                  className="text-primary underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  {project.githubRepoUrl.replace(/^https?:\/\//, "")}
                </a>
              ) : (
                "Connect GitHub to sync branches"
              )
            }
            icon={GitPullRequest}
          />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)_340px]">
        <div className="space-y-6">
          <Panel
            icon={MessagesSquare}
            title="Agent chat"
            description="Drive sessions with natural language. The agent responds with plans, diffs, and tool calls."
            actions={
              <Button size="sm" variant="subtle" className="rounded-full px-4">
                View history
              </Button>
            }
          >
            <div className="space-y-3">
              {chatMessages.map((message, index) => (
                <div
                  key={index}
                  className={cn(
                    "rounded-2xl border border-white/10 px-4 py-3 text-sm shadow-inner",
                    message.role === "assistant"
                      ? "bg-primary/10 text-primary-foreground"
                      : "bg-white/5 text-foreground"
                  )}
                >
                  <div className="mb-1 flex items-center justify-between text-xs uppercase tracking-[0.28em] text-muted-foreground">
                    <span>{message.role === "assistant" ? "Agent" : "You"}</span>
                    <span>{message.timestamp}</span>
                  </div>
                  <p className="text-sm leading-relaxed text-foreground">
                    {message.content}
                  </p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel
            icon={FileCode2}
            title="Files & resources"
            description="Live file system syncs every approved change."
            actions={
              <Button variant="ghost" size="sm" className="rounded-full">
                Open explorer
              </Button>
            }
          >
            <div className="space-y-4 text-sm">
              {fileTree.map((group) => (
                <div key={group.section}>
                  <p className="font-medium uppercase tracking-[0.28em] text-muted-foreground">
                    {group.section}
                  </p>
                  <ul className="mt-2 space-y-2 text-muted-foreground">
                    {group.items.map((item) => (
                      <li
                        key={item}
                        className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/5 px-3 py-2 font-mono text-xs"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Panel>

          <Panel
            icon={Bot}
            title="Timeline"
            description="Every tool call, diff, and deployment checkpoint is logged."
          >
            <div className="relative space-y-4">
              {timelineEvents.map((event, index) => (
                <div
                  key={event.title}
                  className="relative rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-muted-foreground"
                >
                  <div className="flex items-center justify-between text-xs uppercase tracking-[0.28em]">
                    <span className="text-foreground">{event.title}</span>
                    <span>{event.time}</span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed">
                    {event.detail}
                  </p>
                  {index < timelineEvents.length - 1 && (
                    <span className="absolute left-[1.2rem] top-full h-4 w-px bg-white/10" />
                  )}
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel
            icon={FileCode2}
            title="Editor workspace"
            description="Monaco editor with Prettier on save and AI inline suggestions."
            actions={
              <Button size="sm" variant="outline" className="rounded-full">
                Open in fullscreen
              </Button>
            }
          >
            <div className="rounded-2xl border border-white/10 bg-black/40 p-5 font-mono text-sm text-slate-200">
              <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-[0.28em] text-muted-foreground">
                <span className="flex h-2.5 w-2.5 items-center justify-center rounded-full bg-red-500" />
                <span className="flex h-2.5 w-2.5 items-center justify-center rounded-full bg-yellow-500" />
                <span className="flex h-2.5 w-2.5 items-center justify-center rounded-full bg-green-500" />
                <span className="ml-3 text-muted-foreground">
                  studio/workbench.tsx
                </span>
              </div>
              <pre className="space-y-1 overflow-x-auto text-[13px] leading-6">
                <code>
                  {`const panels = createPanels({
  left: ["chat", "files"],
  center: ["editor", "diff"],
  right: ["preview", "terminal"],
});

return (
  <Workbench
    projectId="${project.id}"
    panels={panels}
    aiSession={currentSession}
  />
);`}
                </code>
              </pre>
            </div>
          </Panel>

          <Panel
            icon={Diff}
            title="Diff review"
            description="Approve or edit each change before applying it to the filesystem."
            actions={
              <Button size="sm" className="rounded-full">
                Group by intent
              </Button>
            }
          >
            <div className="space-y-3">
              {diffFiles.map((file) => (
                <div
                  key={file.path}
                  className="flex items-start justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm"
                >
                  <div>
                    <p className="font-mono text-xs text-foreground">
                      {file.path}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {file.summary}
                    </p>
                  </div>
                  <Badge
                    variant={
                      file.status === "new"
                        ? "success"
                        : file.status === "pending"
                        ? "accent"
                        : "outline"
                    }
                    className="whitespace-nowrap"
                  >
                    {file.status}
                  </Badge>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel
            icon={PlayCircle}
            title="Preview"
            description="Spin up a WebContainer to see live changes instantly."
            actions={
              <Button size="sm" variant="outline" className="rounded-full">
                Open preview
              </Button>
            }
          >
            <div className="aspect-video w-full overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-primary/10 via-background to-background p-6">
              <div className="flex h-full w-full flex-col justify-between rounded-2xl border border-white/5 bg-black/30 p-5 text-sm text-muted-foreground">
                <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em]">
                  <span>localhost:5173</span>
                  <span>Live</span>
                </div>
                <div className="space-y-3">
                  <div className="h-10 w-3/4 rounded-full bg-white/10" />
                  <div className="grid grid-cols-3 gap-3">
                    <div className="h-28 rounded-2xl bg-white/10" />
                    <div className="h-28 rounded-2xl bg-white/5" />
                    <div className="h-28 rounded-2xl bg-white/10" />
                  </div>
                </div>
              </div>
            </div>
          </Panel>

          <Panel
            icon={TerminalSquare}
            title="Command console"
            description="Run bun, drizzle-kit, or custom commands. All logs stream here."
          >
            <div className="rounded-2xl border border-white/10 bg-black/60 p-5 font-mono text-[12px] text-slate-200">
              <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-[0.28em] text-muted-foreground">
                <span>webcontainer</span>
                <span>ready</span>
              </div>
              <pre className="space-y-1">
                <code>{`bun run lint
✔ @codalyn/studio lint passed

bun run type-check
✔ found 0 errors

drizzle-kit generate
✔ migrations synced with Supabase`}</code>
              </pre>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Panel({
  icon: Icon,
  title,
  description,
  actions,
  children,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-4 rounded-[24px] border border-white/10 bg-white/[0.05] p-5 shadow-surface-lg">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-primary/10 text-primary">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
            {description && (
              <p className="text-xs leading-relaxed text-muted-foreground">
                {description}
              </p>
            )}
          </div>
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}

function InfoTile({
  title,
  detail,
  icon: Icon,
}: {
  title: string;
  detail: ReactNode;
  icon: LucideIcon;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
          {title}
        </p>
        <div className="mt-2 text-sm text-foreground">{detail}</div>
      </div>
    </div>
  );
}

