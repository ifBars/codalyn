import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { SpinningLogo } from "@/components/landing/SpinningLogo";
import { requireAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { signOutAction } from "@/server/actions/auth";
import {
  FolderKanban,
  PanelRight,
  Rocket,
  Sparkles,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import { ReactNode } from "react";

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

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireAuth();

  return (
    <div className="relative flex min-h-screen bg-background/60">
      <aside className="glass-panel relative hidden w-[300px] flex-col border-r border-white/10 bg-white/5/60 px-6 py-8 lg:flex">
        <Link href="/projects" className="group flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-primary/50 via-primary/20 to-accent/30 shadow-glow overflow-hidden">
            <SpinningLogo className="h-full w-full p-1.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold tracking-tight">
                Codalyn Studio
              </span>
              <Badge variant="accent" className="rounded-full">
                Beta
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              AI-native workflow for shipping web apps.
            </p>
          </div>
        </Link>

        <nav className="mt-10 space-y-3">
          {navLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group block rounded-3xl border border-white/5 bg-white/5/20 px-5 py-4 transition hover:border-white/30 hover:bg-white/10"
            >
              <div className="flex items-center gap-3">
                <item.icon className="h-5 w-5 text-primary/80 transition duration-200 group-hover:scale-105" />
                <span className="text-sm font-semibold tracking-wide">
                  {item.name}
                </span>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {item.description}
              </p>
            </Link>
          ))}
        </nav>

        <div className="mt-auto space-y-4 pt-8">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-primary/10 text-primary">
                <PanelRight className="h-4 w-4" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  Need an instant preview?
                </p>
                <p className="text-xs text-muted-foreground">
                  Launch the live sandbox after selecting a project.
                </p>
              </div>
            </div>
            <Link
              href="/projects"
              className={cn(
                buttonVariants({
                  variant: "outline",
                  size: "sm",
                }),
                "mt-4 w-full justify-center border-white/20 bg-white/10 text-xs uppercase tracking-widest"
              )}
            >
              View projects
            </Link>
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/5 px-4 py-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                Signed in
              </p>
              <p className="text-sm font-medium text-foreground">
                {user.email}
              </p>
            </div>
            <form action={signOutAction}>
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                className="rounded-full border border-white/10 bg-white/5 px-4"
              >
                Log out
              </Button>
            </form>
          </div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-white/5 bg-background/60 backdrop-blur-xl lg:hidden">
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
              <form action={signOutAction}>
                <Button variant="outline" size="sm" className="rounded-full">
                  Logout
                </Button>
              </form>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 pb-10 pt-8 lg:px-10">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
            <div className="hidden w-full items-center justify-between rounded-3xl border border-white/5 bg-white/5 px-6 py-4 lg:flex">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <Workflow className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Flow status
                  </p>
                  <p className="text-xs text-muted-foreground">
                    AI agent ready. Sandboxes provision on demand.
                  </p>
                </div>
              </div>
              <Link
                href="/projects/new"
                className={cn(buttonVariants({ variant: "primary", size: "sm" }))}
              >
                <Rocket className="mr-2 h-4 w-4" />
                Start new build
              </Link>
            </div>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

