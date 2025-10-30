import { Badge } from "@/components/ui/badge";
import { SignInForms } from "./signin-forms";
import { getUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";

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
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-20 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[800px] w-[800px] rounded-full bg-primary/15 blur-[250px]" />
        <div className="absolute top-1/4 right-1/4 h-[600px] w-[600px] rounded-full bg-accent/10 blur-[200px]" />
        <div className="absolute bottom-0 left-1/3 h-[500px] w-[500px] rounded-full bg-primary/10 blur-[200px]" />
      </div>

      <div className="relative z-10 w-full max-w-2xl">
        <div className="mb-8 text-center">
          <Badge variant="accent" className="mb-6 inline-flex gap-2">
            <Sparkles className="h-3 w-3" />
            Build with AI
          </Badge>
        </div>

        <div className="mb-12 text-center">
          <h1 className="mb-4 text-5xl font-bold leading-tight tracking-tight sm:text-6xl lg:text-7xl">
            What should we{" "}
            <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              build
            </span>{" "}
            for you?
          </h1>
          <p className="mx-auto max-w-lg text-lg text-muted-foreground sm:text-xl">
            Tell Codalyn what you want to create, and watch it design, build,
            and deploy your vision—right from your browser.
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

        <div className="glass-panel rounded-[32px] border border-white/10 p-8 shadow-glow sm:p-10 mb-8">
          <SignInForms />
        </div>

        <p className="text-center text-xs text-muted-foreground">
          By continuing you agree to receive one-time emails about your
          workspace activity.
        </p>
      </div>
    </div>
  );
}
