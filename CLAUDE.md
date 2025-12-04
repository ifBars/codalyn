# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Codalyn is an AI-powered frontend builder that helps users create React applications through natural language conversation. The system uses Gemini AI with vision support to generate React components in real-time, previewed in WebContainers.

**Core Architecture:** Monorepo with Next.js 15 App Router studio + specialized workspace packages for sandboxing, tools, and AI orchestration.

## Monorepo Structure

This is a Bun-based workspace monorepo organized as follows:

- **apps/studio**: Next.js 15 App Router application (main UI and chat interface)
- **packages/accuralai**: Unified LLM orchestration with MDAP sub-agent support (Anthropic, OpenAI, Google, Ollama)
- **packages/sandbox**: Sandbox engines (WebContainers for in-browser dev, Docker for heavy tasks)
- **packages/tools**: AI tool schemas and executors (filesystem, git, package management, search)
- **packages/runtime**: Environment typing, telemetry, and utilities for generated apps
- **packages/shared**: Shared types, constants, and utilities
- **packages/dsl**: (Optional) Domain-specific language parser
- **packages/generators**: (Optional) Code generation utilities

## Common Development Commands

### Building and Running

```bash
# Install dependencies (Bun required >= 1.0.0)
bun install

# Start dev server (runs Next.js studio on port 3000)
bun run dev

# Build all packages for production
bun run build

# Type checking across all packages
bun run type-check

# Lint all packages
bun run lint

# Format code with Prettier
bun run format
```

### Studio-Specific Commands

```bash
# Navigate to studio app
cd apps/studio

# Run dev server with Turbopack
bun run dev

# Database operations (Drizzle + Supabase Postgres)
bun run db:generate    # Generate migrations
bun run db:push        # Push schema changes to database
bun run db:studio      # Open Drizzle Studio UI
```

### Package Development

```bash
# Build specific package
bun run --filter='@codalyn/sandbox' build

# Watch mode for a package
cd packages/accuralai
bun run dev
```

## Key Architectural Concepts

### 1. AI Orchestration (AccuralAI + MDAP)

The system uses a custom AI orchestration layer built on the AccuralAI package, implementing the MDAP (Multi-Disciplinary Agent Protocol) pattern:

- **Main Agent**: Orchestrates task decomposition and routing (in `apps/studio/src/lib/ai/core/agent.ts`)
- **Sub-Agents**: Specialized agents for code generation, testing, review, design, debugging, architecture, QA, and finalization (configured in `apps/studio/src/lib/ai/mdap.ts`)
- **Model Adapters**: Support for multiple LLM providers through AccuralAI (Gemini, OpenRouter, Anthropic)
- **Tool System**: Zod-validated JSON schema tools that AI can invoke to interact with the sandbox

**Important Files:**
- `apps/studio/src/lib/ai/index.ts`: Public API exports
- `apps/studio/src/lib/ai/core/agent.ts`: Think → Act → Observe loop implementation
- `apps/studio/src/lib/ai/providers/accuralai.ts`: AccuralAI adapter for Codalyn
- `apps/studio/src/lib/ai/mdap.ts`: MDAP orchestrator with specialized sub-agents

### 2. Sandbox System

Two sandbox implementations provide isolated execution environments:

- **WebContainerSandbox** (`packages/sandbox/src/webcontainer.ts`): Runs Vite + React in-browser using WebContainer API. Used for instant dev server and live preview.
- **DockerSandbox** (`packages/sandbox/src/docker.ts`): Runs builds, migrations, and tests in isolated Docker containers with resource limits.

Both implement the `SandboxInterface` defined in `packages/sandbox/src/types.ts`.

**File synchronization:** Changes are buffered until user approval, then applied via filesystem operations and git commits.

### 3. Tool System

AI tools are defined as JSON schemas with Zod validation in `packages/tools/src/definitions.ts`. Categories include:

- **Filesystem**: `read_file`, `write_file`, `list_directory`, `delete_path`, `glob_search`, `find_in_files`, `replace_in_file`, `apply_patch`
- **Git**: `git_status`, `git_branch`, `git_diff`, `git_commit`, `git_push`, `git_checkout`, `git_revert`
- **Package Management**: `npm_install`, `npm_uninstall`
- **Sandbox**: `sandbox_info`, `port_list`, `open_port`
- **Search**: `search_project` (semantic search using embeddings)
- **Context7**: `context7_get_docs`, `context7_resolve_library` (fetch NPM/library documentation)
- **Browser**: `capture_screenshot` (visual feedback for AI)
- **Metadata**: `project_info`, `env_read`, `env_write`

Tool executors are in `packages/tools/src/executors/` organized by category.

### 4. Database (Supabase + Drizzle)

The app uses Supabase Postgres with Drizzle ORM:

- **Schema**: `apps/studio/src/lib/db/schema.ts` defines tables for users, projects, sandboxes, AI sessions, tool logs, file snapshots, and deployments
- **Auth**: Supabase Auth with email/OAuth (GitHub, Google) via `apps/studio/src/lib/auth.ts`
- **RLS**: Row-level security policies ensure user data isolation
- **Migrations**: Generated via `bun run db:generate` and pushed with `bun run db:push`

Environment variables needed:
- `DATABASE_URL`: Postgres connection string
- `NEXT_PUBLIC_SUPABASE_URL`: Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Public anon key
- `SUPABASE_SERVICE_ROLE_KEY`: Service role key (server-only)

### 5. Generated Projects Architecture

When AI generates a project, it scaffolds:
- **Vite 5** dev server with HMR
- **React 18** with TypeScript
- **Tailwind CSS 3** for styling
- **Modern patterns**: Functional components, hooks, proper TypeScript types

Template structure created by the AI includes proper `package.json`, `tsconfig.json`, and `vite.config.ts`.

## Environment Setup

Required environment variables (see `apps/studio/.env.example`):

```bash
# AI Provider (at least one required)
GEMINI_API_KEY=                  # Get from https://makersuite.google.com/app/apikey

# Supabase
NEXT_PUBLIC_SUPABASE_URL=        # From Supabase dashboard
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=                     # Postgres connection string

# Site configuration
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Optional integrations
DOCKER_SOCKET_PATH=/var/run/docker.sock
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

## Key Design Patterns

### Agent Think-Act-Observe Loop

The core agent runs iterations where it:
1. **Think**: Model generates response with potential tool calls
2. **Act**: Execute tool calls through sandbox
3. **Observe**: Add tool results to conversation memory
4. Loop until no more tool calls or max iterations reached

This pattern is implemented in `apps/studio/src/lib/ai/core/agent.ts:19-147`.

### Memory Management

`ConversationMemory` (`apps/studio/src/lib/ai/core/memory.ts`) maintains chat history with system prompts and message pruning to stay within context limits.

### Tool Call Parsing

The system normalizes tool calls/results from different LLM providers into a consistent format using `apps/studio/src/lib/ai/core/parser.ts`. This handles provider-specific quirks.

### Safety and Guardrails

- **Path constraints**: Tools are limited to project workspace (no access to system files)
- **Command allowlist**: Dangerous commands blocked by default
- **Resource limits**: Timeouts and memory caps on sandbox operations
- **Audit logs**: All tool calls logged to `tool_logs` table

## TypeScript Workspace References

The root `tsconfig.json` defines path aliases for all packages:

```json
{
  "@codalyn/sandbox": ["./packages/sandbox/src"],
  "@codalyn/tools": ["./packages/tools/src"],
  "@codalyn/runtime": ["./packages/runtime/src"],
  "@codalyn/shared": ["./packages/shared/src"],
  "@codalyn/accuralai": ["./packages/accuralai/src"]
}
```

Each package has its own `tsconfig.json` that extends the root config.

## When Working on Features

1. **AI improvements**: Modify system prompts in `apps/studio/src/lib/ai/core/prompts.ts` and agent logic in `apps/studio/src/lib/ai/core/agent.ts`
2. **New tools**: Add schema to `packages/tools/src/definitions.ts`, implement executor in `packages/tools/src/executors/`, and register in `packages/tools/src/registry.ts`
3. **Sandbox features**: Update `SandboxInterface` in `packages/sandbox/src/types.ts` and implement in both WebContainer and Docker sandbox classes
4. **Database changes**: Update schema in `apps/studio/src/lib/db/schema.ts`, then run `bun run db:generate` and `bun run db:push`
5. **Frontend components**: Use shadcn/ui patterns (components in `apps/studio/src/components/ui/`), Tailwind for styling, and Zustand for state management

## Testing Strategy

Currently, the project does not have a comprehensive test suite. When adding tests:
- Unit tests: Vitest for packages
- Integration tests: Test AI tool execution and sandbox operations
- E2E tests: Playwright for Studio UI flows

## Known Limitations

- WebContainers have Node.js limitations (no native modules, limited filesystem)
- Docker sandbox requires Docker daemon running locally or remotely
- Some tools (like `search_project`) require vector embeddings to be pre-computed
- Rate limiting and API quotas depend on the LLM provider used

## Additional Context

- The project follows the architecture outlined in `PLAN.md` (Supabase integration, MDAP orchestration, WebContainers/Docker sandboxing)
- Code generation follows modern React/TypeScript best practices
- The UI uses Next.js App Router with React Server Components and Server Actions
- Monaco Editor is used for code editing with TypeScript support
