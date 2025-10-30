"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { signInWithEmail } from "@/server/actions/auth";
import { createClient } from "@/lib/supabase-client";
import { GitBranch, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SignInForms() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

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

  return (
    <div className="space-y-6">
      <Button
        type="button"
        onClick={handleGitHubSignIn}
        disabled={isLoading}
        size="lg"
        className="w-full justify-center gap-3"
      >
        <GitBranch className="h-5 w-5" />
        {isLoading ? "Redirecting..." : "Continue with GitHub"}
      </Button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-white/10" />
        </div>
        <div className="relative flex justify-center text-xs uppercase tracking-[0.24em] text-muted-foreground">
          <span className="bg-background px-3">or use email</span>
        </div>
      </div>

      <form action={signInWithEmail} className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">
            Work email
          </label>
          <Input
            type="email"
            name="email"
            placeholder="you@company.com"
            required
            autoComplete="email"
          />
        </div>
        <Button
          type="submit"
          variant="outline"
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

