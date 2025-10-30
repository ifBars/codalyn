import { Badge } from "@/components/ui/badge";
import { SignInForms } from "./signin-forms";
import { getUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Bot, FileDiff, PanelsTopLeft, Workflow } from "lucide-react";

const featureCards = [
  {
    title: "Chat to build",
    description: "Plan, discuss, and approve diffs in a collaborative AI chat.",
    icon: Bot,
  },
  {
    title: "Real-time canvas",
    description: "Monaco editing, live preview, and command console in one surface.",
    icon: PanelsTopLeft,
  },
  {
    title: "Diff-first workflows",
    description: "Group edits by intent, inspect chunks, and apply with confidence.",
    icon: FileDiff,
  },
  {
    title: "Ship from the browser",
    description: "Run builds, sync with GitHub, and deploy without leaving Codalyn.",
    icon: Workflow,
  },
] as const;

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; email_sent?: string }>;
}) {
  const user = await getUser();

  if (user) {
    redirect("/projects");
  }

  const params = await searchParams;
  const decodedError = params.error ? decodeURIComponent(params.error) : null;

  return (
    <div className="relative mx-auto flex min-h-screen max-w-6xl items-center justify-center px-6 py-12 sm:px-10 lg:px-16">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-[18%] top-[-10%] h-[420px] w-[420px] rounded-full bg-primary/20 blur-[200px]" />
        <div className="absolute right-[-5%] top-[30%] h-[440px] w-[440px] rounded-full bg-accent/15 blur-[210px]" />
      </div>

      <div className="grid w-full items-center gap-12 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-10 text-balance">
          <Badge variant="accent" className="w-fit">
            In-browser AI engineer
          </Badge>
          <div className="space-y-4">
            <h1 className="text-4xl font-semibold leading-tight sm:text-5xl">
              Build ambitious products from a single, modern studio
            </h1>
            <p className="max-w-xl text-lg text-muted-foreground">
              Codalyn pairs you with an agent that plans, previews, and ships
              production-ready code across your stack. Stay in flow with a
              workspace that feels as polished as V0 or Lovable—but with your
              own repository in the loop.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {featureCards.map((feature) => (
              <div
                key={feature.title}
                className="glass-panel group rounded-3xl border border-white/10 p-5 transition duration-200 hover:border-white/40 hover:shadow-glow"
              >
                <feature.icon className="mb-4 h-10 w-10 text-primary/90 transition duration-200 group-hover:scale-105" />
                <h3 className="text-lg font-medium">{feature.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
          <div className="hidden rounded-3xl border border-white/10 bg-white/5/50 p-6 shadow-surface-lg backdrop-blur-xl lg:block">
            <p className="text-sm font-medium text-muted-foreground">
              Upcoming runs
            </p>
            <div className="mt-4 space-y-3 text-sm text-muted-foreground">
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <span className="font-medium text-foreground">
                  Generate marketing site
                </span>
                <span className="text-xs tracking-wide text-primary/80">
                  Running…
                </span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-white/5 px-4 py-3">
                <span>Sync GitHub PR #42</span>
                <span className="text-xs text-muted-foreground">Queued</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-white/5 px-4 py-3">
                <span>Deploy preview build</span>
                <span className="text-xs text-muted-foreground">
                  Scheduled
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="glass-panel relative rounded-[32px] border border-white/10 p-10 shadow-glow lg:p-12">
          <div className="absolute right-10 top-10 flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-success shadow-[0_0_0_6px_rgba(34,197,94,0.2)]" />
            Live
          </div>
          <div className="space-y-8">
            <div className="space-y-3 text-center">
              <h2 className="text-2xl font-semibold">
                Sign in to Codalyn Studio
              </h2>
              <p className="text-sm text-muted-foreground">
                Secure Supabase auth with GitHub or email magic link.
              </p>
            </div>

            {decodedError && (
              <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {decodedError}
              </div>
            )}

            {params.email_sent === "true" && (
              <div className="rounded-2xl border border-success/40 bg-success/10 px-4 py-3 text-sm text-success-foreground">
                Check your email for a sign-in link! It may take a few seconds.
              </div>
            )}

            <SignInForms />

            <p className="text-center text-xs text-muted-foreground">
              By continuing you agree to receive one-time emails about your
              workspace activity.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

