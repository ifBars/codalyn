"use client";

import { useEffect, useRef, useState } from "react";
import { WebContainerManager } from "@/lib/webcontainer-manager";
import { GeminiClient, AIMessage, FileOperation } from "@/lib/gemini-client";
import { captureIframeScreenshot } from "@/lib/screenshot";
import { ArrowUp, Camera, Code, Eye, Loader2 } from "lucide-react";

export default function BuilderPage() {
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [showApiKeyInput, setShowApiKeyInput] = useState(true);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const geminiClientRef = useRef<GeminiClient | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Initialize WebContainer on mount
  useEffect(() => {
    async function init() {
      try {
        console.log("Initializing WebContainer...");
        const { url } = await WebContainerManager.initProject();
        setPreviewUrl(url);
        console.log("WebContainer ready at:", url);
      } catch (error) {
        console.error("Failed to initialize WebContainer:", error);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Failed to initialize WebContainer: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ]);
      } finally {
        setIsInitializing(false);
      }
    }

    init();
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Initialize Gemini client when API key is provided
  const handleApiKeySubmit = () => {
    if (geminiApiKey.trim()) {
      geminiClientRef.current = new GeminiClient(geminiApiKey);
      setShowApiKeyInput(false);
      setMessages([
        {
          role: "assistant",
          content:
            "👋 Hi! I'm your AI frontend developer. I can help you build beautiful React apps with Tailwind CSS. Just describe what you want to create, and I'll build it for you!",
        },
      ]);
    }
  };

  // Send message to AI
  const handleSend = async (includeScreenshot: boolean = false) => {
    if (!input.trim() || isLoading || !geminiClientRef.current) return;

    const userMessage = input.trim();
    setInput("");
    setIsLoading(true);

    try {
      // Capture screenshot if requested
      let screenshot: string | undefined;
      if (includeScreenshot && iframeRef.current) {
        const captured = await captureIframeScreenshot(iframeRef.current);
        if (captured) {
          screenshot = captured;
        }
      }

      // Add user message
      const userMsg: AIMessage = {
        role: "user",
        content: userMessage,
        screenshot,
      };
      setMessages((prev) => [...prev, userMsg]);

      // Generate AI response
      let fullResponse = "";
      let operations: FileOperation[] = [];

      const assistantMsg: AIMessage = {
        role: "assistant",
        content: "",
      };
      setMessages((prev) => [...prev, assistantMsg]);

      // Stream the response
      for await (const chunk of geminiClientRef.current.streamGenerate(
        userMessage,
        screenshot,
        messages
      )) {
        if (chunk.text) {
          fullResponse += chunk.text;
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              content: fullResponse,
            };
            return updated;
          });
        }

        if (chunk.operations) {
          operations = chunk.operations;
        }
      }

      // Apply file operations
      if (operations.length > 0) {
        console.log("Applying operations:", operations);
        for (const op of operations) {
          if (op.type === "write" && op.content) {
            await WebContainerManager.writeFile(op.path, op.content);
            console.log(`✓ Wrote ${op.path}`);
          } else if (op.type === "delete") {
            await WebContainerManager.rm(op.path);
            console.log(`✓ Deleted ${op.path}`);
          }
        }

        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            operations,
          };
          return updated;
        });
      }
    } catch (error) {
      console.error("Error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  if (showApiKeyInput) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
          <h1 className="mb-2 text-3xl font-bold text-gray-900">
            Codalyn Builder
          </h1>
          <p className="mb-6 text-gray-600">
            Enter your Gemini API key to get started
          </p>
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">
                Gemini API Key
              </label>
              <input
                type="password"
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleApiKeySubmit();
                  }
                }}
                placeholder="AIza..."
                className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="mt-2 text-xs text-gray-500">
                Get your free API key at{" "}
                <a
                  href="https://makersuite.google.com/app/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:underline"
                >
                  Google AI Studio
                </a>
              </p>
            </div>
            <button
              onClick={handleApiKeySubmit}
              disabled={!geminiApiKey.trim()}
              className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Start Building
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800 bg-gray-950 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600">
            <Code className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Codalyn Builder</h1>
            <p className="text-xs text-gray-400">AI-Powered Frontend Builder</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat Panel */}
        <div className="flex w-1/2 flex-col border-r border-gray-800 bg-gray-900">
          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-6">
            {isInitializing && (
              <div className="flex items-center gap-3 rounded-lg bg-gray-800 p-4">
                <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
                <span className="text-sm text-gray-300">
                  Initializing WebContainer...
                </span>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`rounded-lg p-4 ${
                  msg.role === "user"
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-800 text-gray-100"
                }`}
              >
                {msg.screenshot && (
                  <div className="mb-2 flex items-center gap-2 text-xs opacity-70">
                    <Camera className="h-3 w-3" />
                    <span>Screenshot included</span>
                  </div>
                )}
                <p className="whitespace-pre-wrap text-sm leading-relaxed">
                  {msg.content}
                </p>
                {msg.operations && msg.operations.length > 0 && (
                  <div className="mt-3 space-y-1 rounded-md bg-black/20 p-3 text-xs">
                    <div className="font-medium opacity-70">
                      {msg.operations.length} file operation
                      {msg.operations.length !== 1 ? "s" : ""}:
                    </div>
                    {msg.operations.map((op, i) => (
                      <div key={i} className="opacity-60">
                        • {op.type} {op.path}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center gap-3 rounded-lg bg-gray-800 p-4">
                <Loader2 className="h-5 w-5 animate-spin text-indigo-400" />
                <span className="text-sm text-gray-300">AI is thinking...</span>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-gray-800 bg-gray-950 p-4">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend(false);
                    }
                  }}
                  placeholder="Describe what you want to build..."
                  disabled={isLoading || isInitializing}
                  className="w-full resize-none rounded-lg border border-gray-700 bg-gray-800 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
                  rows={3}
                />
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => handleSend(true)}
                  disabled={!input.trim() || isLoading || isInitializing}
                  className="rounded-lg bg-gray-700 p-3 text-gray-300 hover:bg-gray-600 disabled:opacity-50"
                  title="Send with screenshot"
                >
                  <Camera className="h-5 w-5" />
                </button>
                <button
                  onClick={() => handleSend(false)}
                  disabled={!input.trim() || isLoading || isInitializing}
                  className="rounded-lg bg-indigo-600 p-3 text-white hover:bg-indigo-700 disabled:opacity-50"
                  title="Send"
                >
                  <ArrowUp className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Preview Panel */}
        <div className="flex w-1/2 flex-col bg-gray-950">
          <div className="flex items-center justify-between border-b border-gray-800 px-6 py-3">
            <div className="flex items-center gap-2 text-sm text-gray-400">
              <Eye className="h-4 w-4" />
              <span>Live Preview</span>
            </div>
            {previewUrl && (
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-indigo-400 hover:underline"
              >
                Open in new tab
              </a>
            )}
          </div>
          <div className="flex-1 bg-white">
            {previewUrl ? (
              <iframe
                ref={iframeRef}
                src={previewUrl}
                className="h-full w-full border-0"
                title="Preview"
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-gray-600" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
