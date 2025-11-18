import Link from "next/link";
import {
  ArrowRight,
  Layers,
  Rocket,
  ShieldCheck,
  Sparkles,
  Workflow,
} from "lucide-react";

const features = [
  {
    title: "Describe the experience",
    body:
      "Draft a product spec or paste your rough prompt. Codalyn works with your copy, data contracts, and custom constraints without extra setup.",
    icon: Sparkles,
  },
  {
    title: "Generate prod-ready UI",
    body:
      "Every response is TypeScript, Tailwind, and accessibility checked. You can replay prompts or request multi-file edits in the same session.",
    icon: Layers,
  },
  {
    title: "Own your stack",
    body:
      "Projects live entirely in your browser. Export anytime, wire to Git, or keep iterating in WebContainers with instant preview.",
    icon: Workflow,
  },
];

const steps = [
  {
    title: "Start with a prompt",
    detail: "Create a project, add a short description, and drop in any starter files. WebContainers boot a Vite + React sandbox instantly.",
  },
  {
    title: "Paste your Gemini key",
    detail: "We never proxy or store credentials. The key lives in localStorage and requests go straight from your browser to Google.",
  },
  {
    title: "Iterate visually",
    detail: "Each AI change streams into the IDE, diffs are persisted per project, and you can reopen builds anytime from the dashboard.",
  },
];

export default function LandingPage() {
  return (
    <main className="flex-1">
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-8 lg:px-12">
        <header className="flex flex-col items-center justify-between gap-4 rounded-3xl border border-white/10 bg-white/5/50 px-6 py-5 text-sm text-muted-foreground shadow-surface-lg backdrop-blur xl:flex-row">
          <Link href="/" className="flex items-center gap-3 text-foreground">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-primary/50 via-primary/10 to-accent/30 text-lg font-semibold text-white shadow-glow">
              C
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">
                Codalyn
              </p>
              <p className="text-base font-semibold text-foreground">
                AI web app builder
              </p>
            </div>
          </Link>
          <nav className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.3em]">
            <Link href="/" className="rounded-full border border-white/10 px-4 py-2 text-foreground">
              Home
            </Link>
            <Link href="/dashboard" className="rounded-full border border-white/10 px-4 py-2 text-muted-foreground transition hover:text-foreground">
              Dashboard
            </Link>
            <Link href="/builder" className="rounded-full border border-white/10 px-4 py-2 text-muted-foreground transition hover:text-foreground">
              Builder
            </Link>
          </nav>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/dashboard"
              className="rounded-full border border-primary/40 bg-primary/10 px-5 py-2 text-sm font-semibold text-primary transition hover:bg-primary/20"
            >
              Get started
            </Link>
            <Link
              href="/builder"
              className="flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-sm text-muted-foreground transition hover:text-foreground"
            >
              Open builder <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </header>

        <section className="mt-14 grid gap-10 lg:grid-cols-2 lg:items-center">
          <div className="space-y-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.4em] text-muted-foreground">
              <Rocket className="h-4 w-4" /> Instant sandboxes
            </span>
            <div className="space-y-4 text-balance">
              <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
                Design, build, and iterate entire React products from a single brief.
              </h1>
              <p className="text-lg text-muted-foreground">
                Codalyn pairs the Gemini API with WebContainers so you can prompt, preview, and persist production-ready UI—no servers, logins, or infra required.
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-glow"
              >
                Create a project
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/builder"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-foreground"
              >
                Explore the builder
              </Link>
            </div>
            <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
              <div>
                <p className="text-3xl font-semibold text-foreground">8× faster</p>
                <p>from prompt to preview</p>
              </div>
              <div>
                <p className="text-3xl font-semibold text-foreground">0 servers</p>
                <p>all client-side</p>
              </div>
              <div>
                <p className="text-3xl font-semibold text-foreground">100% yours</p>
                <p>projects never leave your browser</p>
              </div>
            </div>
          </div>
          <div className="relative">
            <div className="gradient-border rounded-[32px] bg-black/30 p-1">
              <div className="rounded-[28px] border border-white/5 bg-gradient-to-br from-slate-900/70 to-slate-950 p-6 shadow-glow">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <p>Dashboard preview</p>
                  <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-foreground">
                    Local storage only
                  </span>
                </div>
                <div className="mt-6 space-y-4">
                  {["Marketing site", "Internal CRM", "Mobile landing"].map((project, index) => (
                    <div
                      key={project}
                      className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
                    >
                      <div>
                        <p className="font-semibold text-foreground">{project}</p>
                        <p className="text-xs text-muted-foreground">Edited 0{index + 2}/15 · Stored in browser</p>
                      </div>
                      <span className="text-xs text-success">Ready</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="pointer-events-none absolute -left-10 -top-8 h-32 w-32 rounded-full bg-primary/30 blur-[90px]" />
          </div>
        </section>

        <section className="mt-20 grid gap-6 lg:grid-cols-3">
          {features.map((feature) => (
            <article
              key={feature.title}
              className="glass-panel flex flex-col gap-3 rounded-[28px] border border-white/5 p-6"
            >
              <feature.icon className="h-10 w-10 text-primary" />
              <h3 className="text-xl font-semibold">{feature.title}</h3>
              <p className="text-sm text-muted-foreground">{feature.body}</p>
            </article>
          ))}
        </section>

        <section className="mt-20 grid gap-10 rounded-[32px] border border-white/10 bg-white/5 p-8 shadow-surface-lg lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">
              How it works
            </p>
            <h2 className="text-3xl font-semibold tracking-tight">
              Your secure AI workspace
            </h2>
            <p className="text-base text-muted-foreground">
              Codalyn is intentionally local-first. No databases, no auth, no waiting on a remote agent cluster. Every key press, prompt, and file stays within your browser session.
            </p>
            <div className="space-y-6">
              {steps.map((step, index) => (
                <div key={step.title} className="flex gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sm font-semibold text-primary">
                    0{index + 1}
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-foreground">{step.title}</h3>
                    <p className="text-sm text-muted-foreground">{step.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-6 rounded-[24px] border border-white/5 bg-black/30 p-6">
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-10 w-10 text-success" />
              <div>
                <p className="text-base font-semibold text-foreground">
                  Private by design
                </p>
                <p className="text-xs text-muted-foreground">
                  API keys stay encrypted in localStorage; we never transmit or log them.
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-muted-foreground">
              <p className="font-semibold text-foreground">Local persistence</p>
              <p className="mt-2">
                Every project keeps metadata, prompts, and generated files inside IndexedDB/localStorage. Close the tab, come back later, and continue exactly where you left off.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-muted-foreground">
              <p className="font-semibold text-foreground">Key transparency</p>
              <p className="mt-2">
                We link directly to Google AI Studio so you can issue and rotate your own Gemini credentials at any time. Deleting them from Codalyn is a single click.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-muted-foreground">
              <p className="font-semibold text-foreground">WebContainer sandbox</p>
              <p className="mt-2">
                Run Vite + React inside the browser with instant previews, hot reload, and zero setup. It's the exact environment the AI edits, so there are no surprises.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-20 rounded-[32px] border border-white/10 bg-gradient-to-br from-primary/20 via-white/10 to-transparent p-8 text-center">
          <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground">
            Ready to build
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">
            Launch your dashboard, paste your Gemini key, and ship UI today.
          </h2>
          <p className="mx-auto mt-3 max-w-3xl text-sm text-muted-foreground">
            No waiting list, no backend, no hidden costs. Codalyn is a pure client-side studio that respects your data. Open the dashboard to create a project or jump straight into the builder when you're ready.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-glow"
            >
              Get started free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/builder"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-foreground"
            >
              Go to builder
            </Link>
          </div>
        </section>

        <footer className="mt-16 flex flex-col justify-between gap-4 border-t border-white/10 py-6 text-sm text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} Codalyn. Built with WebContainers + Gemini.</p>
          <div className="flex flex-wrap gap-4">
            <Link href="/dashboard" className="hover:text-foreground">
              Dashboard
            </Link>
            <Link href="/builder" className="hover:text-foreground">
              Builder
            </Link>
            <a
              href="https://makersuite.google.com/app/apikey"
              target="_blank"
              rel="noreferrer"
              className="hover:text-foreground"
            >
              Get a Gemini key
            </a>
          </div>
        </footer>
      </div>
    </main>
  );
}
