# Codalyn - AI-Powered Web App Builder

An in-browser AI engineer that builds full-stack web applications from natural language specifications.

## Architecture

Monorepo structure with npm workspaces:
- `apps/studio` - Next.js 15 App Router Studio (chat + editor + preview)
- `packages/sandbox` - Sandbox execution engine (WebContainers + Docker)
- `packages/tools` - AI tool schemas and executors
- `packages/runtime` - Runtime utilities for generated apps
- `packages/shared` - Shared types and utilities

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Auth**: Supabase Auth
- **Database**: Supabase Postgres with Drizzle ORM
- **AI**: Google Gemini (function calling)
- **Sandbox**: WebContainers (in-browser) + Docker (heavy tasks)
- **UI**: Tailwind CSS + shadcn/ui + Zustand
- **Code Editor**: Monaco Editor
- **Git**: GitHub integration

## Setup

1. Install Bun (if not already installed):
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```

2. Clone the repository
3. Install dependencies:
   ```bash
   bun install
   ```

4. Set up environment variables:
   - Copy `.env.example` to `.env.local`
   - Fill in Supabase credentials
   - Add Gemini API key
   - Add GitHub OAuth credentials

5. Set up Supabase:
   - Create a new Supabase project
   - Copy the connection string to `DATABASE_URL`
   - Run migrations:
     ```bash
     cd apps/studio
     bun run db:generate
     bun run db:migrate
     ```

6. Start development server:
   ```bash
   bun run dev
   ```

## Development

- `bun run dev` - Start dev server
- `bun run build` - Build all packages
- `bun run lint` - Lint all packages
- `bun run type-check` - Type check all packages

## Project Structure

- AI uses function/tool calling to directly interact with workspace
- Tools include: read_file, write_file, run_command, git operations, npm operations, database operations
- Sandbox provides isolated execution environment
- All changes tracked in GitHub repositories
