# AI-Powered In-Browser AI Engineer Plan (Supabase + Lovable/v0-style)

## Architecture Overview

Monorepo (npm workspaces):

- `apps/studio` – Next.js 15 App Router Studio (chat + editor + preview)
- `packages/sandbox` – Sandbox engine (WebContainers for dev, Docker for heavy tasks)
- `packages/tools` – AI tool schemas and executors (read/write files, run commands, git, db)
- `packages/runtime` – Env typing, telemetry, utilities for generated apps
- `packages/shared` – Shared types, feature flags, permissions

## Core Concept

- Gemini uses structured tool calls to operate on a repo workspace: read/write files, list dirs, run terminal, git operations; no DSL.
- WebContainers provide instant in-browser dev server; Docker runs builds/migrations/tests remotely; changes sync by file-diff.
- Supabase provides auth (email/OAuth), Postgres DB with RLS, storage, and optional edge functions.
- User stays in the loop: plan → preview diff → apply → run. Safe-by-default.

## Supabase Integration

- Auth: Supabase Auth (email magic link, GitHub/Google). Next.js App Router SSR helpers for server actions.
- DB: Supabase Postgres for users, projects, sandboxes, sessions, tool_logs, file_snapshots, deployments, analytics.
- RLS: policies per organization/project; use service role key only in server actions/edge functions.
- Storage: artifacts (ZIP exports, screenshots, logs) via buckets.
- Edge Functions: webhooks (GitHub), background tasks (e.g., long builds notifications).

## Security, Safety, and Guardrails

- Tool allowlist with per-project permissions (filescope, commands, network). Default deny outside project root.
- Sensitive path protection (`.env`, `node_modules`, `.git`) with explicit escalate workflow.
- Command sandbox: parse/deny dangerous commands (rm -rf, curl|bash). Resource limits (CPU, mem, timeout).
- Prompt-injection mitigations: system policy reminders, path-locked context, never execute external code without user confirmation.
- Secrets handling: Supabase env + encrypted per-user secrets store (GitHub/Vercel tokens).
- Audit log every tool call (inputs/outputs/diffs) in Supabase.

## Observability & Reliability

- Structured logs for AI/tool calls; session traces.
- Rate limiting, backoff, circuit breakers.
- Checkpoints/snapshots before apply; rollback via git or stored patches.
- Crash recovery and reconciliation.

## UX Flows

- Chat-first planning → diff review → apply → run.
- Panels: Chat, Files, Editor (Monaco), Terminal, Preview, Diffs, Timeline.
- Approvals per-file/per-chunk; auto-group related edits.

## Tools Surface (JSON Schema-constrained)

- Filesystem: `read_file`, `write_file`, `list_directory`, `delete_path`, `glob_search`.
- Commands: `run_command` (cwd, args, env, timeout, background=false).
- Git: `git_status`, `git_branch`, `git_diff`, `git_commit`, `git_push`, `git_checkout`, `git_revert`.
- Packages: `npm_install`, `npm_uninstall`.
- DB (Supabase): `db_query` (RPC allowlist), `db_insert`, `db_update`, `db_delete`, `db_select` via PostgREST.
- Drizzle (for generated app schemas): `drizzle_migrate`, `drizzle_generate` targeting Supabase Postgres.
- Sandbox: `sandbox_info`, `port_list`, `open_port`.
- Net (limited): `http_fetch` to allowlist (npm, GitHub raw, shadcn registry).
- Metadata: `project_info`, `env_read`, `env_write`, `feature_flags_read`.

## Model & Agent Strategy

- Primary: Gemini (free tier) with function calling; streaming.
- Fallback: light refactor model for deterministic transforms.
- Agents: Planner → Executor → Reviewer (lint/tests gate).

## Data and Storage

- Supabase Postgres is source of truth; GitHub is code remote.
- Branching: `main` + feature branches per session; PRs for major changes.
- Snapshots as patches in Supabase for rollback.

## Studio (apps/studio)

- Next.js 15, Tailwind, shadcn/ui, Zustand.
- Auth with Supabase; server components fetch session; RLS-safe client calls.
- Monaco with TS/JS/TSX/MDX/SQL; inline diagnostics; Prettier on save.
- WebContainers dev server and logs; file sync view.
- Server actions: AI agent, sandbox ops, GitHub ops, Supabase ops.

## Sandbox (packages/sandbox)

- Interface: FS, exec, ports, logs.
- WebContainers: Node 20; limitations handled; install caching.
- Docker: Node 20 + tooling; resource limits; ephemeral volumes; log streaming.
- Sync: pending edits buffer until approval; apply writes to fs and git.

## Tools (packages/tools)

- Zod/JSON Schemas per tool; typed inputs/outputs; examples.
- Executors: sandbox, git, supabase; redact secrets; stable output shape.
- Registry: versioned tools; capability discovery.

## AI Integration

- System prompt: coding standards, directory constraints, safety rules, tool docs.
- Context: repo tree, key files, package.json, current diffs, last errors, open ports.
- Execute: dry-run to compute diffs; present to user; apply after approval.

## GitHub Integration

- OAuth app; repo create, branches, PRs.
- Commits either via local git in sandbox or REST content API.
- Status checks via Docker tests/linters; PR comments.

## Code Generation Workflow

1) Bootstrap Next.js 15 app (Tailwind, shadcn/ui, Zustand, Zod, ESLint/Prettier).
2) Configure Drizzle pointing to Supabase Postgres + drizzle-kit config.
3) Add Supabase Auth (client, SSR helpers, route protection).
4) Scaffold entities, CRUD pages/routes, Zod forms using Supabase client (PostgREST) and server actions.
5) Env typing: `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only), `GITHUB_TOKEN`.
6) Analytics hooks to Supabase tables.
7) Start dev server in WebContainers; preview.

## Testing & Quality Gates

- ESLint + Prettier; Vitest + Testing Library; Playwright (Docker).
- lint-staged pre-commit; CI templates for GitHub Actions (install, lint, test, build).
- Reviewer agent blocks apply on failures.

## Telemetry & Analytics

- Anon usage by default; opt-in per-user detail.
- Track tool usage, latencies, failures, LOC changed, outcomes; store in Supabase.

## Deployment & Export

- Prepare for Vercel (vercel.json if needed); manual deploy path.
- Export ZIP; store artifacts in Supabase Storage (optional).
- Preview branch builds in Docker to validate.

## Roadmap

- Connectors: OpenAPI → client generation, Stripe, Slack, webhooks.
- Multi-tenant orgs: teams, roles, RLS policies, quotas, billing.
- Template gallery; multi-model routing.

## Key Files

- Root: `package.json`, `tsconfig.json`, `.eslintrc.json`, `.prettierrc`, `.env.example`.
- `apps/studio`: `lib/{gemini,github,sandbox,supabase}.ts`, `server/actions/{ai,projects}.ts`, `app/(dashboard)/*`, components.
- `packages/sandbox`: `src/{types,webcontainer,docker,manager}.ts`.
- `packages/tools`: `src/{definitions,registry,executors,git,fs,command,db}.ts`.
- `packages/runtime`: `src/{env,telemetry}.ts`.

## Initial Scaffold (files)

- Workspace config (npm workspaces, TS refs).
- Next.js skeleton with Tailwind and shadcn/ui.
- Supabase client and SSR helpers.
- Tool schemas and stubs including Supabase DB tools.
- Sandbox interface and WebContainer bootstrap.
- Basic AI chat route with mock tools.