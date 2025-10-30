# Repository Guidelines

## Project Structure & Module Organization
This Bun-managed monorepo keeps the Next.js 15 app in `apps/studio`. Routes and layouts belong in `apps/studio/src/app`, shared hooks and utilities live in `apps/studio/src/lib`, and server actions stay in `apps/studio/src/server`. Database schema files and migrations are in `apps/studio/drizzle`, controlled by `drizzle.config.ts`; mirror any schema change with a migration before shipping. Reusable domain logic is split across `packages/*` (`shared` for primitives, `dsl` for schema helpers, `runtime` and `sandbox` for execution, `tools` for editor integrations). Each package compiles TypeScript from `src` to `dist` and is consumed via the `@codalyn/*` workspace aliases defined in `tsconfig.json`.

## Build, Test, and Development Commands
Run `bun install` once per checkout. Common workflows:
- `bun run dev` — spins up the studio app on localhost with hot reloading.
- `bun run build` — builds every workspace package and the studio app.
- `bun run lint` / `bun run type-check` — enforce ESLint and strict TypeScript across all workspaces.
- `bun run format` — apply Prettier formatting to the supported file set.
- `bun run --filter=@codalyn/studio db:generate` then `db:push` — manage Drizzle migrations against the configured database.

## Coding Style & Naming Conventions
TypeScript is strict by default (`tsconfig.json`), so keep code type-complete. Use 2-space indentation, trailing commas, and always let Prettier format before pushing. React components should be `PascalCase`, hooks and utilities `camelCase`, route segments in `apps/studio/src/app` should follow `kebab-case`, and environment variables in uppercase snake case. Run ESLint on touched packages to catch App Router-specific rules.

## Testing Guidelines
There is no unified test runner yet; when you introduce tests, colocate them next to the source as `*.test.ts` (or under `__tests__`) and wire a `bun test` script in the affected package. At minimum, run `bun run type-check` and `bun run lint` before opening a PR. Include manual QA notes for UI flows and database migrations you exercised.

## Commit & Pull Request Guidelines
Use Conventional Commits (`feat:`, `fix:`, `chore:`) so workspace release tooling can group changes. Scope commit messages to the package or feature touched (e.g., `feat(runtime): add execution sandbox`). PRs should summarize the problem, link issues, describe testing, and attach UI screenshots or schema diffs when relevant. Request review from maintainers responsible for touched packages.

## Security & Configuration Tips
Keep secrets out of the repo—store Supabase keys and service role credentials in `.env.local`. Validate that `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are present before running auth-related actions. Never commit files like `dbpw.txt`; treat it as local-only reference. Update Drizzle migrations carefully, and double-check `.env` aligns with Supabase and database instances before running `db:push`.
