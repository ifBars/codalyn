# Codalyn - AI-Powered Web App Builder

An in-browser AI engineer that builds full-stack web applications from natural language specifications using **Gemini 2.5 Flash Lite**.

## ✨ Features

- 🤖 **AI-Powered Development** - Uses Google Gemini 2.5 Flash Lite for intelligent code generation
- 💬 **Natural Language Interface** - Describe what you want to build in plain English
- 🔧 **Tool Calling** - AI can read/write files, run commands, manage git, and more
- 🎨 **Live Preview** - See your application running in real-time
- 📦 **WebContainer Support** - Run Node.js in the browser for instant previews
- 🗄️ **Database Integration** - Built-in Supabase integration with Drizzle ORM

## Architecture

Monorepo structure with Bun workspaces:
- `apps/studio` - Next.js 15 App Router Studio (chat + editor + preview)
- `packages/sandbox` - Sandbox execution engine (WebContainers + Docker + Mock)
- `packages/tools` - AI tool schemas and executors
- `packages/runtime` - Runtime utilities for generated apps
- `packages/shared` - Shared types and utilities

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Auth**: Supabase Auth
- **Database**: Supabase Postgres with Drizzle ORM
- **AI**: Google Gemini 2.5 Flash Lite (function calling)
- **Sandbox**: WebContainers (browser) + Mock (server-side)
- **UI**: Tailwind CSS + shadcn/ui + Zustand
- **Code Editor**: Monaco Editor
- **Git**: GitHub integration

## 🚀 Quick Start

### Prerequisites

- **Bun** >= 1.0.0 ([Install](https://bun.sh))
- **Google Gemini API Key** ([Get one free](https://makersuite.google.com/app/apikey))
- **Supabase Account** ([Sign up](https://supabase.com))

### Setup in 5 Minutes

1. **Install Bun** (if not already installed):
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```

2. **Clone and Install**:
   ```bash
   git clone <your-repo-url>
   cd codalyn
   bun install
   ```

3. **Configure Environment**:
   ```bash
   cd apps/studio
   cp .env.example .env.local
   ```

   Edit `.env.local` and add:
   - `GEMINI_API_KEY` - Your Gemini API key
   - `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon key
   - `DATABASE_URL` - Your Supabase database connection string

4. **Set up Database** (if using Supabase):
   ```bash
   bun run db:push
   ```

5. **Start Development**:
   ```bash
   cd ../..  # Back to root
   bun run dev
   ```

6. **Open Your Browser**:
   Visit [http://localhost:3000](http://localhost:3000) and start building! 🎉

## 🎯 How It Works

1. **Chat with the AI** - Describe what you want to build
2. **AI Plans & Executes** - Gemini 2.5 Flash Lite breaks down the task and uses tools to implement it
3. **Real-time Preview** - See your app come to life as the AI builds it
4. **Iterate & Deploy** - Refine with natural language and deploy when ready

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
