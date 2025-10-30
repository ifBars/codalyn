import { Badge } from "@/components/ui/badge";
import { SignInForms } from "./signin-forms";
import { getUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sparkles, ArrowRight } from "lucide-react";

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
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-16 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[900px] w-[900px] rounded-full bg-primary/20 blur-[280px]" />
        <div className="absolute top-1/3 -right-1/4 h-[700px] w-[700px] rounded-full bg-accent/12 blur-[220px]" />
        <div className="absolute bottom-0 left-1/4 h-[600px] w-[600px] rounded-full bg-primary/15 blur-[240px]" />
      </div>

      <div className="relative z-10 w-full max-w-3xl">
        <div className="mb-8 text-center">
          <Badge variant="accent" className="mb-8 inline-flex gap-2">
            <Sparkles className="h-3 w-3" />
            Powered by AI
          </Badge>
        </div>

        <div className="mb-10 text-center">
          <h1 className="mb-6 text-5xl font-bold leading-tight tracking-tight sm:text-6xl lg:text-7xl">
            What should we{" "}
            <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              build
            </span>{" "}
            together?
          </h1>
          <p className="mx-auto max-w-xl text-base text-muted-foreground sm:text-lg">
            From idea to production. Design, code, test, and deploy full-stack apps using natural
            language—without leaving your browser.
          </p>
        </div>

        {decodedError && (
          <div className="mb-6 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive text-center">
            {decodedError}
          </div>
        )}

        {params.email_sent === "true" && (
          <div className="mb-6 rounded-2xl border border-success/40 bg-success/10 px-4 py-3 text-sm text-success-foreground text-center">
            Check your email for a sign-in link! It may take a few seconds.
          </div>
        )}

        <div className="glass-panel rounded-3xl border border-white/10 p-1 shadow-glow mb-8 bg-gradient-to-b from-white/5 to-transparent">
          <div className="rounded-3xl bg-background/80 backdrop-blur-xl p-6 sm:p-8">
            <div className="relative mb-6">
              <input
                type="text"
                placeholder="Build a React dashboard with real-time data..."
                className="w-full rounded-xl border border-white/10 bg-white/5 px-5 py-4 text-base text-foreground placeholder-muted-foreground transition focus:border-white/30 focus:outline-none focus:ring-2 focus:ring-primary/50"
                disabled
              />
              <button className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-primary hover:bg-primary/90 p-2.5 text-foreground transition disabled:opacity-50">
                <ArrowRight className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <SignInForms />
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          By continuing you agree to receive one-time emails about your workspace activity.
        </p>

        <div className="mt-12 pt-8 border-t border-white/10">
          <p className="text-center text-xs text-muted-foreground mb-4">TRUSTED BY DEVELOPERS</p>
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-8 opacity-60">
            <div className="text-xs font-semibold text-muted-foreground">GitHub</div>
            <div className="text-xs font-semibold text-muted-foreground">Vercel</div>
            <div className="text-xs font-semibold text-muted-foreground">Supabase</div>
            <div className="text-xs font-semibold text-muted-foreground">React</div>
          </div>
        </div>
      </div>
    </div>
  );
}
