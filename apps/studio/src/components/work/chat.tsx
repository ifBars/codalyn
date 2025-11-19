"use client";

import { useEffect, useRef, useState, useTransition, useImperativeHandle, forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createAISession, chatWithAI } from "@/server/actions/ai";
import { ThumbsUp, ThumbsDown, MoreVertical, Plus, ArrowUp } from "lucide-react";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: Array<{ name: string; args: any; result?: any }>;
};

export interface ChatHandle {
  sendMessage: (message: string) => void;
}

const Chat = forwardRef<ChatHandle, { 
  projectId: string;
  sessionId?: string;
}>(({ 
  projectId, 
  sessionId: initialSessionId 
}, ref) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "seed-1",
      role: "assistant",
      content:
        "Tell me what you want to build. I can plan tasks, propose diffs, and show a live preview.",
    },
  ]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId || null);
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const scrollerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  // Load session history on mount
  useEffect(() => {
    if (isInitialized || !initialSessionId) {
      setIsInitialized(true);
      return;
    }

    async function loadHistory() {
      try {
        const response = await fetch(`/api/sessions/${initialSessionId}/messages`);
        if (response.ok) {
          const data = await response.json();
          if (data.messages && data.messages.length > 0) {
            setMessages(data.messages);
          }
        }
      } catch (error) {
        console.error("Failed to load session history:", error);
      } finally {
        setIsInitialized(true);
      }
    }

    loadHistory();
  }, [initialSessionId, isInitialized]);

  async function sendMessage(text: string) {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = { 
      id: crypto.randomUUID(), 
      role: "user", 
      content: text.trim()
    };
    setMessages((m) => [...m, userMsg]);
    setIsLoading(true);

    startTransition(async () => {
      try {
        // Ensure we have a session
        let currentSessionId = sessionId;
        if (!currentSessionId) {
          const newSession = await createAISession(projectId);
          currentSessionId = newSession.id;
          setSessionId(currentSessionId);
        }

        // Call AI
        const { response, toolCalls } = await chatWithAI(
          currentSessionId,
          text.trim(),
          projectId
        );

        const assistantMsg: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: response,
          toolCalls,
        };
        setMessages((m) => [...m, assistantMsg]);
      } catch (error) {
        const errorMsg: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: `Error: ${error instanceof Error ? error.message : "Failed to get response"}`,
        };
        setMessages((m) => [...m, errorMsg]);
      } finally {
        setIsLoading(false);
      }
    });
  }

  async function send() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    await sendMessage(text);
  }

  // Expose sendMessage via ref
  useImperativeHandle(ref, () => ({
    sendMessage,
  }));

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Messages Area */}
      <div ref={scrollerRef} className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.map((m) => (
          <div key={m.id} className="space-y-2">
            <div
              className={cn(
                "rounded-2xl px-4 py-3 text-sm leading-relaxed",
                m.role === "assistant"
                  ? "bg-white/5 text-foreground"
                  : "bg-primary/10 text-primary-foreground"
              )}
            >
              <p className="whitespace-pre-wrap">{m.content}</p>
              {m.toolCalls && m.toolCalls.length > 0 && (
                <div className="mt-2 space-y-1 rounded-lg bg-white/5 p-2 text-xs">
                  <div className="font-medium text-muted-foreground">
                    {m.toolCalls.length} tool call{m.toolCalls.length !== 1 ? "s" : ""}
                  </div>
                  {m.toolCalls.map((tc, idx) => (
                    <div key={idx} className="text-muted-foreground">
                      • {tc.name}({Object.keys(tc.args || {}).length} args)
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {m.role === "assistant" && (
              <div className="flex items-center gap-2 px-4">
                <button className="p-1 text-muted-foreground hover:text-foreground transition-colors">
                  <ThumbsUp className="h-4 w-4" />
                </button>
                <button className="p-1 text-muted-foreground hover:text-foreground transition-colors">
                  <ThumbsDown className="h-4 w-4" />
                </button>
                <button className="p-1 text-muted-foreground hover:text-foreground transition-colors">
                  <MoreVertical className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        ))}
        
        {isLoading && (
          <div className="rounded-2xl bg-white/5 px-4 py-3 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
              <span>AI is thinking...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-white/10 p-4">
        <div className="flex items-end gap-2">
          <div className="flex flex-1 flex-col gap-2">
            <div className="flex items-center gap-2">
              <button className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-muted-foreground hover:bg-white/10 transition-colors">
                <Plus className="h-4 w-4" />
              </button>
              <button className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:bg-white/5 transition-colors">
                Select
              </button>
              <button className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground hover:bg-white/5 transition-colors">
                Plan
              </button>
            </div>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ask Codalyn..."
              disabled={isLoading}
              className="min-h-[44px] w-full resize-none rounded-xl border border-white/10 bg-background/60 px-4 py-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-colors disabled:opacity-50"
              rows={1}
            />
          </div>
          <div className="flex flex-col gap-2">
            <button
              onClick={send}
              disabled={!input.trim() || isLoading}
              className="rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

Chat.displayName = "Chat";

export default Chat;
