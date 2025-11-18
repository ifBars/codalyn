"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { ArrowUp, ChevronDown, Code, Eye, FileCode, Loader2 } from "lucide-react";

import { GeminiClient, AIMessage, FileOperation } from "@/lib/gemini-client";
import {
  StoredProject,
  applyFileOperationsToProject,
  clearStoredGeminiKey,
  getActiveProjectId,
  getProjectById,
  getStoredGeminiKey,
  listProjects,
  markProjectOpened,
  setActiveProjectId,
  setStoredGeminiKey,
} from "@/lib/project-storage";
import { WebContainerManager } from "@/lib/webcontainer-manager";

const welcomeMessages = (): AIMessage[] => [
  {
    role: "assistant",
    content:
      "👋 Hi! I'm your AI frontend developer. Describe the experience you want, share any constraints, and I'll draft full React + Tailwind files in your private sandbox.",
  },
];

const formatTimestamp = (value?: string) => {
  if (!value) return "not yet";
  try {
    return new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    }).format(new Date(value));
  } catch {
    return "recently";
  }
};

const PROJECT_STORAGE_KEY = "codalyn.projects.v1";

export default function BuilderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isHydratingProject, setIsHydratingProject] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [isGeminiReady, setIsGeminiReady] = useState(false);
  const [isCheckingKey, setIsCheckingKey] = useState(true);
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [availableProjects, setAvailableProjects] = useState<StoredProject[]>([]);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [activeProject, setActiveProject] = useState<StoredProject | null>(null);
  const [projectError, setProjectError] = useState<string | null>(null);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const geminiClientRef = useRef<GeminiClient | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hydratedProjectRef = useRef<string | null>(null);

  const projectIdFromQuery = searchParams.get("projectId");

  const refreshProjects = useCallback(() => {
    setAvailableProjects(listProjects());
  }, []);

  useEffect(() => {
    refreshProjects();
    if (typeof window === "undefined") return;
    const handler = (event: StorageEvent) => {
      if (!event.key || event.key === PROJECT_STORAGE_KEY) {
        refreshProjects();
      }
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, [refreshProjects]);

  useEffect(() => {
    async function init() {
      try {
        const { url } = await WebContainerManager.initProject();
        setPreviewUrl(url);
      } catch (error) {
        console.error("Failed to initialize WebContainer", error);
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content:
              error instanceof Error
                ? `Failed to initialize WebContainer: ${error.message}`
                : "Failed to initialize WebContainer.",
          },
        ]);
      } finally {
        setIsInitializing(false);
      }
    }

    init();
  }, []);

  useEffect(() => {
    if (!projectIdFromQuery) {
      const storedId = getActiveProjectId();
      if (storedId) {
        setProjectId(storedId);
        router.replace(`/builder?projectId=${storedId}`);
      }
      return;
    }

    setProjectId(projectIdFromQuery);
    setActiveProjectId(projectIdFromQuery);
  }, [projectIdFromQuery, router]);

  useEffect(() => {
    if (!projectId) {
      setActiveProject(null);
      setProjectError(
        "Choose a project from your dashboard to save every file locally."
      );
      return;
    }

    const hydrated = markProjectOpened(projectId) || getProjectById(projectId);
    if (!hydrated) {
      setActiveProject(null);
      setProjectError("We couldn't find that project in this browser.");
      return;
    }

    setProjectError(null);
    setActiveProject(hydrated);
  }, [projectId]);

  useEffect(() => {
    if (!activeProject || isInitializing) return;
    if (hydratedProjectRef.current === activeProject.id) return;

    let cancelled = false;
    async function hydrate() {
      setIsHydratingProject(true);
      try {
        await WebContainerManager.replaceProjectFiles(activeProject.files);
        if (!cancelled) {
          hydratedProjectRef.current = activeProject.id;
          setStatusMessage(`Loaded ${activeProject.name} from local storage.`);
        }
      } catch (error) {
        console.error("Failed to hydrate project", error);
        if (!cancelled) {
          setProjectError("Something went wrong hydrating the saved files.");
        }
      } finally {
        if (!cancelled) {
          setIsHydratingProject(false);
        }
      }
    }

    hydrate();
    return () => {
      cancelled = true;
    };
  }, [activeProject, isInitializing]);

  useEffect(() => {
    const storedKey = getStoredGeminiKey();
    if (storedKey) {
      connectGeminiClient(storedKey);
      setGeminiApiKey(storedKey);
    } else {
      setIsKeyModalOpen(true);
    }
    setIsCheckingKey(false);
  }, []);

  const connectGeminiClient = (apiKey: string) => {
    geminiClientRef.current = new GeminiClient(apiKey);
    setIsGeminiReady(true);
    setMessages(welcomeMessages());
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (!statusMessage) return;
    const timeout = setTimeout(() => setStatusMessage(null), 4000);
    return () => clearTimeout(timeout);
  }, [statusMessage]);

  const handleApiKeySubmit = () => {
    const trimmed = geminiApiKey.trim();
    if (!trimmed) {
      setApiKeyError("Enter your Gemini API key to continue.");
      return;
    }
    if (!trimmed.startsWith("AI") && !trimmed.startsWith("AIza")) {
      setApiKeyError("That doesn't look like a Gemini API key.");
      return;
    }

    setStoredGeminiKey(trimmed);
    connectGeminiClient(trimmed);
    setIsKeyModalOpen(false);
    setApiKeyError(null);
    setStatusMessage("Gemini key saved privately in this browser.");
  };

  const handleClearApiKey = () => {
    clearStoredGeminiKey();
    geminiClientRef.current = null;
    setIsGeminiReady(false);
    setIsKeyModalOpen(false);
    setGeminiApiKey("");
    setMessages([]);
  };

  const handleSend = async (includeContext = false) => {
    if (!input.trim() || isLoading) return;
    if (!geminiClientRef.current) {
      setIsKeyModalOpen(true);
      return;
    }
    if (!activeProject) {
      setProjectError("Select a project from your dashboard before chatting.");
      return;
    }

    let userMessage = input.trim();
    setInput("");
    setIsLoading(true);

    try {
      let screenshot: string | undefined;
      if (includeContext) {
        try {
          const appContent = await WebContainerManager.readFile("src/App.tsx");
          userMessage = `${userMessage}\n\nCurrent src/App.tsx:\n\n\`\`\`tsx\n${appContent}\n\`\`\``;
        } catch (error) {
          console.warn("Unable to grab context", error);
        }
      }

      const userMsg: AIMessage = { role: "user", content: userMessage, screenshot };
      const history = [...messages, userMsg];
      setMessages([...history, { role: "assistant", content: "" }]);

      let fullResponse = "";
      let operations: FileOperation[] = [];

      for await (const chunk of geminiClientRef.current.streamGenerate(
        userMessage,
        screenshot,
        history
      )) {
        if (chunk.text) {
          fullResponse += chunk.text;
          setMessages((prev) => {
            const next = [...prev];
            next[next.length - 1] = { ...next[next.length - 1], content: fullResponse };
            return next;
          });
        }

        if (chunk.operations) {
          operations = chunk.operations;
        }
      }

      if (operations.length > 0) {
        for (const op of operations) {
          if (op.type === "write" && op.content) {
            await WebContainerManager.writeFile(op.path, op.content);
          } else if (op.type === "delete") {
            await WebContainerManager.rm(op.path);
          }
        }

        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { ...next[next.length - 1], operations };
          return next;
        });

        const updated = applyFileOperationsToProject(activeProject.id, operations);
        if (updated) {
          setActiveProject(updated);
          refreshProjects();
          setStatusMessage("Project saved to browser storage.");
        }
      }
    } catch (error) {
      console.error("Error sending prompt", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            error instanceof Error ? `Error: ${error.message}` : "Something went wrong.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProjectChange = (nextId: string) => {
    if (nextId === "__dashboard__") {
      router.push("/dashboard");
      return;
    }
    setProjectId(nextId);
    setActiveProjectId(nextId);
    hydratedProjectRef.current = null;
    router.replace(`/builder?projectId=${nextId}`);
  };

  const keyForm = (mode: "gate" | "modal") => (
    <div className="w-full max-w-md rounded-3xl bg-white p-8 text-gray-900 shadow-2xl">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-indigo-500">
            Gemini access
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Bring your own API key</h1>
        </div>
        {mode === "modal" && (
          <button
            type="button"
            onClick={() => setIsKeyModalOpen(false)}
            className="text-sm text-gray-500 transition hover:text-gray-900"
          >
            Close
          </button>
        )}
      </div>
      <p className="mt-4 text-sm text-gray-600">
        Your Gemini key stays inside this browser and never leaves your device.
        Codalyn does not proxy or log any requests.
      </p>
      <form
        className="mt-6 space-y-4"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          handleApiKeySubmit();
        }}
      >
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-500">
            Gemini API key
          </label>
          <input
            type="password"
            value={geminiApiKey}
            onChange={(event) => {
              setGeminiApiKey(event.target.value);
              setApiKeyError(null);
            }}
            placeholder="AIza..."
            className="w-full rounded-2xl border border-gray-200 px-4 py-3 text-base text-gray-900 outline-none focus:border-indigo-500"
          />
          {apiKeyError && <p className="text-sm text-red-600">{apiKeyError}</p>}
          <p className="text-xs text-gray-500">
            Grab a key in seconds at {" "}
            <a
              href="https://makersuite.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-indigo-600"
            >
              Google AI Studio
            </a>
            .
          </p>
        </div>

        <button
          type="submit"
          className="flex w-full items-center justify-center rounded-2xl bg-gray-900 px-4 py-3 font-semibold text-white transition hover:bg-black"
        >
          Continue with Gemini
        </button>

        {mode === "modal" && (
          <div className="flex flex-col gap-3 text-sm text-gray-500">
            <button
              type="button"
              onClick={handleClearApiKey}
              className="rounded-2xl border border-gray-200 px-4 py-2 text-left text-gray-600 transition hover:border-red-200 hover:text-red-600"
            >
              Remove saved key
            </button>
            <p className="text-xs text-gray-500">
              Removing your key means you will reconnect before running the builder
              again.
            </p>
          </div>
        )}
      </form>
    </div>
  );

  if (isCheckingKey) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950">
        <Loader2 className="h-7 w-7 animate-spin text-white" />
      </div>
    );
  }

  if (!isGeminiReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-950 via-gray-900 to-gray-800 px-6 py-12">
        {keyForm("gate")}
      </div>
    );
  }

  const canSend =
    !!activeProject &&
    !isLoading &&
    !isInitializing &&
    !isHydratingProject &&
    Boolean(input.trim()) &&
    geminiClientRef.current;

  return (
    <div className="flex h-screen flex-col bg-gray-950">
      <header className="flex flex-col gap-4 border-b border-gray-900/60 bg-gray-950 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-lg font-semibold text-white">
              C
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-gray-400">
                Codalyn
              </p>
              <p className="text-lg font-semibold text-white">Builder</p>
            </div>
          </Link>
          <nav className="flex flex-wrap gap-2 text-sm text-gray-400">
            <Link href="/" className="rounded-full border border-white/10 px-3 py-1 transition hover:text-white">
              Landing
            </Link>
            <Link href="/dashboard" className="rounded-full border border-white/10 px-3 py-1 transition hover:text-white">
              Dashboard
            </Link>
            <Link href="/builder" className="rounded-full border border-white/10 px-3 py-1 text-white">
              Builder
            </Link>
          </nav>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-gray-200">
            <ShieldIcon />
            <span>Key stored locally</span>
          </div>
          <button
            onClick={() => {
              setGeminiApiKey(getStoredGeminiKey() ?? "");
              setApiKeyError(null);
              setIsKeyModalOpen(true);
            }}
            className="text-sm font-medium text-indigo-300 transition hover:text-white"
          >
            Manage API key
          </button>
          <Link
            href="/dashboard"
            className="rounded-full border border-indigo-500/40 bg-indigo-500/10 px-4 py-2 text-sm font-semibold text-indigo-100 transition hover:bg-indigo-500/20"
          >
            Open dashboard
          </Link>
        </div>
      </header>

      <section className="border-b border-gray-900/60 bg-gray-950 px-6 py-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-gray-500">Project</p>
            {activeProject ? (
              <div>
                <p className="text-lg font-semibold text-white">{activeProject.name}</p>
                <p className="text-xs text-gray-400">
                  Updated {formatTimestamp(activeProject.updatedAt)}
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-400">No project selected.</p>
            )}
          </div>
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <div className="flex items-center gap-2">
              <select
                value={projectId ?? ""}
                onChange={(event) => handleProjectChange(event.target.value)}
                className="w-48 rounded-2xl border border-white/10 bg-gray-900 px-4 py-2 text-sm text-white focus:border-indigo-400 focus:outline-none"
              >
                <option value="" disabled>
                  Select project
                </option>
                {availableProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
                <option value="__dashboard__">+ Create new project</option>
              </select>
              <ChevronDown className="-ml-8 h-4 w-4 text-gray-500" />
            </div>
            {isHydratingProject && (
              <div className="flex items-center gap-2 text-sm text-indigo-300">
                <Loader2 className="h-4 w-4 animate-spin" />
                Hydrating project files…
              </div>
            )}
            {statusMessage && (
              <p className="text-sm text-green-400">{statusMessage}</p>
            )}
          </div>
        </div>
        {projectError && (
          <p className="mt-3 text-sm text-red-400">{projectError}</p>
        )}
      </section>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex w-full flex-col border-r border-gray-900/60 bg-gray-950 lg:w-1/2">
          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
            {isInitializing && (
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-gray-200">
                <Loader2 className="h-5 w-5 animate-spin text-indigo-300" />
                Provisioning WebContainer…
              </div>
            )}

            {!activeProject && (
              <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 px-5 py-6 text-sm text-gray-200">
                <p className="font-semibold text-white">Projects stay on this device</p>
                <p className="mt-2 text-gray-400">
                  Create a project from the dashboard to capture AI diffs, metadata, and
                  source files in localStorage.
                </p>
                <Link
                  href="/dashboard"
                  className="mt-4 inline-flex items-center gap-2 text-indigo-300 hover:text-white"
                >
                  Open dashboard <ArrowUp className="h-4 w-4 rotate-45" />
                </Link>
              </div>
            )}

            {messages.length <= 1 && !isLoading && (
              <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-[0.4em] text-gray-400">
                  Quick prompts
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {["Design a pricing page with plans", "Generate a CRM dashboard", "Prototype a hero + FAQ section", "Add dark mode toggle"].map(
                    (example) => (
                      <button
                        key={example}
                        onClick={() => setInput(example)}
                        className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-gray-200 transition hover:border-white/30"
                      >
                        {example}
                      </button>
                    )
                  )}
                </div>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div
                key={`${msg.role}-${idx}`}
                className={`rounded-2xl px-4 py-4 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-indigo-600/90 text-white"
                    : "bg-white/5 text-gray-100"
                }`}
              >
                {msg.screenshot && (
                  <div className="mb-2 flex items-center gap-2 text-xs opacity-80">
                    <FileCode className="h-3.5 w-3.5" />
                    Context attached
                  </div>
                )}
                <p className="whitespace-pre-wrap">{msg.content}</p>
                {msg.operations && msg.operations.length > 0 && (
                  <div className="mt-3 rounded-xl bg-black/20 p-3 text-xs text-gray-200">
                    <p className="font-semibold">
                      {msg.operations.length} file change{msg.operations.length > 1 ? "s" : ""}
                    </p>
                    <ul className="mt-2 space-y-1">
                      {msg.operations.map((op, index) => (
                        <li key={`${op.path}-${index}`}>• {op.type} {op.path}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-gray-200">
                <Loader2 className="h-5 w-5 animate-spin text-indigo-300" />
                AI is thinking…
              </div>
            )}
          </div>

          <div className="border-t border-gray-900/60 bg-gray-950 p-4">
            <div className="flex flex-col gap-3 md:flex-row">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    handleSend(false);
                  }
                }}
                placeholder={activeProject ? "Describe what to build next…" : "Select a project first"}
                disabled={!activeProject || isInitializing || isHydratingProject}
                className="flex-1 resize-none rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm text-white placeholder-gray-500 focus:border-indigo-400 focus:outline-none disabled:opacity-60"
                rows={3}
              />
              <div className="flex gap-3 md:flex-col">
                <button
                  onClick={() => handleSend(true)}
                  disabled={!canSend}
                  className="rounded-2xl border border-white/10 bg-white/10 p-3 text-white transition hover:bg-white/20 disabled:opacity-40"
                  title="Send with current file context"
                >
                  <Code className="h-5 w-5" />
                </button>
                <button
                  onClick={() => handleSend(false)}
                  disabled={!canSend}
                  className="rounded-2xl bg-indigo-600 p-3 text-white transition hover:bg-indigo-500 disabled:bg-gray-700"
                  title="Send"
                >
                  <ArrowUp className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="hidden w-1/2 flex-col bg-gray-950 lg:flex">
          <div className="flex items-center justify-between border-b border-gray-900/60 px-6 py-3 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4" /> Live preview
            </div>
            {previewUrl && (
              <a
                href={previewUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-indigo-300 hover:text-white"
              >
                Open in new tab
              </a>
            )}
          </div>
          <div className="flex-1 bg-white">
            {previewUrl ? (
              <iframe ref={iframeRef} src={previewUrl} className="h-full w-full border-0" title="Preview" />
            ) : (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-gray-600" />
              </div>
            )}
          </div>
        </div>
      </div>

      {isKeyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          {keyForm("modal")}
        </div>
      )}
    </div>
  );
}

function ShieldIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className="h-4 w-4 text-green-400"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 3 4.5 6v6c0 4.28 2.99 8.24 7.5 9 4.51-.76 7.5-4.72 7.5-9V6L12 3Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="m9 12 2 2 4-4" />
    </svg>
  );
}
