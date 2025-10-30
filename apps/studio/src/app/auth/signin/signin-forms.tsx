"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signInWithEmail } from "@/server/actions/auth";
import { createClient } from "@/lib/supabase-client";
import { GitBranch, Mail, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignInForms() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [authMode, setAuthMode] = useState<"github" | "email" | null>(null);

  const handleGitHubSignIn = async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();

      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
      const redirectUrl = siteUrl
        ? `${siteUrl}/auth/callback`
        : `${window.location.origin}/auth/callback`;

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "github",
        options: {
          redirectTo: redirectUrl,
        },
      });

      if (error) {
        router.push(
          `/auth/signin?error=${encodeURIComponent(error.message)}`
        );
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      router.push(
        `/auth/signin?error=${encodeURIComponent(
          error instanceof Error ? error.message : "An error occurred"
        )}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (authMode === "email") {
    return (
      <div className="space-y-6">
        <button
          onClick={() => setAuthMode(null)}
          className="text-sm text-muted-foreground hover:text-foreground transition"
        >
          ← Back
        </button>
        <form action={signInWithEmail} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Work email
            </label>
            <Input
              type="email"
              name="email"
              placeholder="you@company.com"
              required
              autoComplete="email"
              className="h-12"
            />
          </div>
          <Button
            type="submit"
            size="lg"
            className="w-full justify-center gap-2"
          >
            <Mail className="h-4 w-4" />
            Send magic link
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <Button
          type="button"
          onClick={handleGitHubSignIn}
          disabled={isLoading}
          size="lg"
          className="w-full justify-center gap-3 text-base h-12"
        >
          <GitBranch className="h-5 w-5" />
          {isLoading ? "Redirecting..." : "Continue with GitHub"}
        </Button>

        <Button
          type="button"
          onClick={() => setAuthMode("email")}
          variant="outline"
          size="lg"
          className="w-full justify-center gap-2 text-base h-12"
        >
          <Mail className="h-4 w-4" />
          Continue with email
        </Button>
      </div>

      <div className="space-y-3 border-t border-white/10 pt-6">
        <p className="text-center text-sm text-muted-foreground font-medium">
          Get started with
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-muted-foreground transition hover:border-white/20 hover:bg-white/10">
            <Zap className="h-4 w-4" />
            <span>New Project</span>
          </button>
          <button className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-muted-foreground transition hover:border-white/20 hover:bg-white/10">
            <Zap className="h-4 w-4" />
            <span>GitHub Repo</span>
          </button>
        </div>
      </div>
    </div>
  );
}
