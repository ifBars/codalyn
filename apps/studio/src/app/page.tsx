"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Github,
  Lightbulb,
  Play,
  Plus,
  Sparkles,
} from "lucide-react";

import { RotatingText } from "@/components/landing/RotatingText";
import { useTypewriterPlaceholder } from "@/lib/useTypewriterPlaceholder";

const PLACEHOLDERS = [
  "Let's build a prototype to validate my...",
  "Create a landing page for my startup...",
  "Build a dashboard to track my metrics...",
  "Design a mobile app interface for...",
  "Develop a web app that helps users...",
  "Make a tool to automate my workflow...",
  "Create an e-commerce site for...",
  "Build a portfolio website showcasing...",
];

export default function LandingPage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  const [isInputFocused, setIsInputFocused] = useState(false);

  const animatedPlaceholder = useTypewriterPlaceholder({
    placeholders: PLACEHOLDERS,
    typingSpeed: 50,
    deletingSpeed: 30,
    pauseDuration: 2000,
    isActive: !isInputFocused && prompt === "",
  });

  const handleBuild = () => {
    if (prompt.trim()) {
      router.push(`/builder?prompt=${encodeURIComponent(prompt.trim())}`);
    } else {
      router.push("/builder");
    }
  };

  const handlePlan = () => {
    router.push("/dashboard");
  };

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden">
      {/* Animated Background Gradients */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-black">
        {/* Large swirling gradient orbs */}
        <div className="animated-gradient-orb animated-gradient-orb-1" />
        <div className="animated-gradient-orb animated-gradient-orb-2" />
        <div className="animated-gradient-orb animated-gradient-orb-3" />
        <div className="animated-gradient-orb animated-gradient-orb-4" />
        <div className="animated-gradient-orb animated-gradient-orb-5" />
        <div className="animated-gradient-orb animated-gradient-orb-6" />

        {/* Additional subtle glow layers */}
        <div className="absolute bottom-0 left-0 right-0 h-[600px] overflow-hidden">
          <div className="absolute bottom-0 left-1/2 h-[400px] w-[800px] -translate-x-1/2 rounded-full bg-gradient-to-t from-purple-500/15 via-purple-500/8 to-transparent blur-3xl" />
          <div className="absolute bottom-0 left-1/2 h-[300px] w-[600px] -translate-x-1/2 rounded-full bg-gradient-to-t from-indigo-500/10 via-indigo-500/5 to-transparent blur-2xl" />
        </div>

        {/* Subtle overlay for better content contrast */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/20" />
      </div>

      {/* Navigation */}
      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4">
        <Link href="/" className="flex items-center gap-2 text-xl font-semibold text-foreground">
          <img src="/logo.png" alt="Codalyn" className="h-24 w-24 object-fill" />
          <span>codalyn</span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <Link href="/dashboard" className="transition hover:text-foreground">
            Dashboard
          </Link>
          <Link href="/builder" className="transition hover:text-foreground">
            Builder
          </Link>
        </nav>
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="hidden text-sm text-muted-foreground transition hover:text-foreground sm:block"
          >
            Get started
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-6 py-20">
        <div className="w-full space-y-8">
          {/* Headline */}
          <div className="space-y-4 text-center">
            <h1 className="flex flex-col items-center justify-center text-5xl font-semibold leading-tight tracking-tight sm:text-6xl md:text-7xl">
              <span>What will you</span>
              <div className="flex items-center gap-3 sm:gap-4">
                <RotatingText />
                <span>today?</span>
              </div>
            </h1>
            <p className="text-lg text-muted-foreground sm:text-xl">
              Create stunning apps & websites by chatting with AI.
            </p>
          </div>

          {/* Input Box */}
          <div className="mx-auto w-full max-w-3xl">
            <div className="rounded-2xl border border-border bg-card p-2 shadow-lg">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onFocus={() => setIsInputFocused(true)}
                  onBlur={() => setIsInputFocused(false)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleBuild();
                    }
                  }}
                  placeholder={animatedPlaceholder}
                  className="flex-1 bg-transparent px-4 py-3 text-base text-foreground placeholder-muted-foreground outline-none"
                />
                <div className="flex items-center gap-2 px-3">
                  <button className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-card">
                    <Plus className="h-4 w-4" />
                  </button>
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground">
                    <Sparkles className="h-4 w-4" />
                    <span>Gemini Agent</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-4 flex items-center justify-end gap-3">
              <button
                onClick={handlePlan}
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm text-foreground transition hover:bg-secondary"
              >
                <Lightbulb className="h-4 w-4" />
                Plan
              </button>
              <button
                onClick={handleBuild}
                className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition hover:opacity-90"
              >
                Build now
                <Play className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Import Options */}
          <div className="flex items-center justify-center gap-4 text-sm text-muted-foreground">
            <span>or import from</span>
            <button className="flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm text-foreground transition hover:bg-secondary">
              <Github className="h-4 w-4" />
              GitHub
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 mx-auto w-full max-w-7xl border-t border-border px-6 py-8">
        <div className="flex flex-col items-center justify-between gap-4 text-sm text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} Codalyn. Built with WebContainers + Gemini.</p>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/dashboard" className="transition hover:text-foreground">
              Dashboard
            </Link>
            <Link href="/builder" className="transition hover:text-foreground">
              Builder
            </Link>
            <a
              href="https://makersuite.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="transition hover:text-foreground"
            >
              Get a Gemini key
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
