import { requireAuth } from "@/lib/auth";
import { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/server/actions/auth";
import {
  Clock,
  FolderOpen,
  Globe,
  Code,
  BarChart3,
} from "lucide-react";

export default async function WorkLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireAuth();

  return (
    <div className="fixed inset-0 flex flex-col bg-background">
      {/* Top Navigation Bar */}
      <header className="flex h-14 items-center justify-between border-b border-white/10 bg-background/95 backdrop-blur-sm px-4">
        <div className="flex items-center gap-6">
          <Link href="/projects" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-gradient-to-br from-primary/50 via-primary/20 to-accent/30 text-sm font-semibold text-primary-foreground">
              C
            </div>
            <span className="text-sm font-semibold">Codalyn</span>
          </Link>
          
          <nav className="hidden items-center gap-1 md:flex">
            <button className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors">
              <Clock className="h-4 w-4" />
            </button>
            <button className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors">
              <FolderOpen className="h-4 w-4" />
            </button>
            <button className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
              <Globe className="h-4 w-4" />
              <span>Preview</span>
            </button>
            <button className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors">
              <Code className="h-4 w-4" />
            </button>
            <button className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors">
              <BarChart3 className="h-4 w-4" />
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <form action={signOutAction}>
            <Button
              type="submit"
              variant="ghost"
              size="sm"
              className="rounded-full text-xs"
            >
              Logout
            </Button>
          </form>
          <div className="h-6 w-6 rounded-full bg-primary/20 border border-primary/30" />
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
