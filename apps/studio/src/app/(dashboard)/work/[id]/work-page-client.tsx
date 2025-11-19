"use client";

import { useRef } from "react";
import { Suspense } from "react";
import { Check } from "lucide-react";
import Chat, { ChatHandle } from "@/components/work/chat";
import Preview from "@/components/work/preview";

interface WorkPageClientProps {
  projectId: string;
  projectName: string;
  sessionId?: string;
}

export default function WorkPageClient({ 
  projectId, 
  projectName,
  sessionId 
}: WorkPageClientProps) {
  const chatRef = useRef<ChatHandle>(null);

  const handleRequestFix = (errors: string) => {
    if (chatRef.current) {
      chatRef.current.sendMessage(errors);
    }
  };

  return (
    <div className="flex h-full">
      {/* Left Sidebar - Chat & Updates */}
      <aside className="flex w-[420px] flex-col border-r border-white/10 bg-background/50">
        <div className="border-b border-white/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">{projectName}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Previewing last saved version
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading chat…</div>}>
            <Chat ref={chatRef} projectId={projectId} sessionId={sessionId} />
          </Suspense>
        </div>
      </aside>

      {/* Right Main Area - Preview */}
      <main className="flex-1 overflow-hidden bg-background">
        <Suspense fallback={<div className="flex h-full items-center justify-center text-sm text-muted-foreground">Starting preview…</div>}>
          <Preview projectId={projectId} onRequestFix={handleRequestFix} />
        </Suspense>
      </main>
    </div>
  );
}

