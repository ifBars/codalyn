"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Maximize2, Share2, Github, ArrowUpRight, Lock } from "lucide-react";

export default function Preview({ projectId }: { projectId: string }) {
  const [isLoading, setIsLoading] = useState(true);
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => setIsLoading(false), 1000);
    return () => clearTimeout(timer);
  }, [projectId]);

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Top Toolbar */}
      <div className="flex h-14 items-center justify-between border-b border-white/10 bg-background/95 backdrop-blur-sm px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 text-xs text-muted-foreground">
            <span>/</span>
            <span className="text-foreground">localhost:5173</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8 rounded-lg text-xs">
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 rounded-lg text-xs">
            <Share2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 rounded-lg text-xs">
            <Github className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 rounded-lg text-xs">
            <ArrowUpRight className="h-4 w-4" />
          </Button>
          <Button size="sm" className="h-8 rounded-lg bg-primary px-4 text-xs font-medium text-primary-foreground">
            Publish
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8 rounded-lg text-xs">
            Login
          </Button>
          <Button variant="outline" size="sm" className="h-8 rounded-lg border-primary/30 bg-primary/10 text-xs text-primary">
            Register
          </Button>
        </div>
      </div>

      {/* Preview Frame */}
      <div className="relative flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/5 via-background to-background">
            <div className="text-center space-y-3">
              <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
              <p className="text-sm text-muted-foreground">Starting preview...</p>
            </div>
          </div>
        ) : (
          <iframe
            ref={frameRef}
            src="about:blank"
            className="h-full w-full border-0"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            title="Preview"
          />
        )}
        
        {/* Placeholder overlay if no preview URL */}
        {!isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-background">
            <div className="text-center space-y-4 px-8">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                <Lock className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-foreground">Preview will appear here</h3>
                <p className="max-w-md text-sm text-muted-foreground">
                  Start a chat session to generate code and see your app come to life. The preview will update automatically as changes are made.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Status Bar */}
      <div className="flex h-8 items-center justify-between border-t border-white/10 bg-background/95 px-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span>Preview</span>
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
            Live
          </span>
        </div>
        <div className="flex items-center gap-4">
          <a href="#" className="hover:text-foreground transition-colors">Help Center</a>
          <a href="#" className="hover:text-foreground transition-colors">Join our Community</a>
        </div>
      </div>
    </div>
  );
}


