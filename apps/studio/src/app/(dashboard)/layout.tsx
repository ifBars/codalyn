"use client";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { SpinningLogo } from "@/components/landing/SpinningLogo";
import { cn } from "@/lib/utils";
import {
  FolderKanban,
  PanelRight,
  Rocket,
  Sparkles,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import { ReactNode } from "react";
import { Sidebar } from "@/components/dashboard/Sidebar";

const navLinks = [
  {
    name: "Projects",
    href: "/projects",
    icon: FolderKanban,
    description: "Manage products and access recent sessions.",
  },
  {
    name: "New project",
    href: "/projects/new",
    icon: Sparkles,
    description: "Kick off a fresh build with a guided brief.",
  },
];

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {

  return (
    <div className="relative flex min-h-screen bg-[#0A0A0A] text-white selection:bg-primary/30">
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

      <Sidebar userEmail="Local User" />

      <div className="flex flex-1 flex-col pl-[80px] transition-all duration-300">
        <header className="sticky top-0 z-20 border-b border-white/5 bg-black/40 backdrop-blur-xl lg:hidden">
          <div className="flex items-center justify-between px-4 py-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Codalyn Studio
              </p>
              <p className="font-semibold">AI-native workspace</p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/projects/new"
                className={cn(buttonVariants({ size: "sm" }), "rounded-full")}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                New
              </Link>
            </div>
          </div>
        </header>

        <main className="relative z-10 flex-1 overflow-y-auto px-4 pb-10 pt-8 lg:px-10">
          <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

