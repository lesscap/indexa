# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (starts server + web + worker watch in parallel)
pnpm dev

# Build / lint / typecheck / test all apps
pnpm build
pnpm lint
pnpm typecheck
pnpm test

# Target a single app
pnpm --filter @indexa/server dev
pnpm --filter @indexa/web dev
pnpm --filter @indexa/server test
pnpm --filter @indexa/web test

# Run a single test file (from app directory)
cd apps/server && npx vitest run src/tests/some.test.ts
cd apps/web && npx vitest run src/test/some.test.tsx

# Database (from apps/server)
pnpm --filter @indexa/server prisma:migrate:dev   # run migrations
pnpm --filter @indexa/server prisma:generate       # regenerate client
pnpm --filter @indexa/server prisma:seed            # seed dev data (admin / indexa123456)
```

```bash
# Worker (from apps/worker, Python 3.12 + uv)
cd apps/worker && uv sync                          # install Python deps
cd apps/worker && uv run pytest                    # run tests
cd apps/worker && uv run python -m indexa_worker run     # one-shot, cron-friendly
cd apps/worker && uv run python -m indexa_worker watch   # long-running, LISTEN/NOTIFY
```

## Architecture

pnpm monorepo (`pnpm@10.32.1`) + one Python sub-project. Apps under `apps/`. `packages/` reserved but unused.

### apps/server — Fastify API (`@indexa/server`)

- **Ports**: 4026 (console API), 4120 (runtime API, placeholder)
- **Bootstrap**: `src/runners/server/` — Fastify app creation and plugin-based route registration
- **Route structure**: `src/apps/{system,console,knowledge-base}/` — each registers as a Fastify plugin
  - `controllers/` — HTTP handlers, `services/` — business logic, `lib/` — helpers (session extraction)
- **Database**: Prisma on PostgreSQL. Schema at `prisma/schema.prisma`, migrations in `prisma/migrations/`
- **Auth**: cookie-based secure sessions (`@fastify/secure-session`). Passwords hashed with scrypt (`src/utils/password.ts`)
- **File uploads**: TUS protocol (`@tus/server`) for resumable uploads → permanent storage
- **Config**: `src/config/app.ts` reads env vars (`DATABASE_URL`, `SESSION_SECRET`, `SESSION_SALT`, `DOCUMENT_STORAGE_ROOT`, etc.)
- **Tests**: `src/tests/**/*.test.ts`, vitest with node environment

### apps/web — React Console (`@indexa/web`)

- **Port**: 4025 (Vite dev server), proxies `/api` → `http://127.0.0.1:4026`
- **Routing**: react-router-dom — `src/app/routes.tsx`
- **Pages**: `src/pages/` (Login, Libraries, LibraryDetail)
- **UI**: Radix UI primitives + Tailwind CSS 4 + shadcn-style components in `src/components/ui/`
- **Path alias**: `@/` → `./src` (configured in vite.config.ts and tsconfig)
- **API client**: `src/lib/api.ts` — typed fetch wrappers. All responses follow `{ success, data } | { success, code, message }`
- **Tests**: `src/test/` and colocated `*.test.tsx`, vitest with jsdom + Testing Library

### apps/worker — Python Vectorization Worker (`@indexa/worker`)

- **Stack**: Python 3.12 + uv. `package.json` is a pnpm proxy that forwards dev/test to uv, so the worker joins `pnpm dev` alongside server + web
- **Role**: consume `IndexJob` queue, run PARSING → CHUNKING → EMBEDDING → UPSERTING → FINALIZING
- **Triggers**:
  - `watch` — long-running daemon using Postgres `LISTEN indexa_job` for real-time wakeups; 30s fallback poll; this is what `pnpm dev` runs
  - `run` — one-shot, cron-friendly; also usable as a safety net alongside `watch`
- **Server handoff**: `queueStoredDocument` issues `SELECT pg_notify('indexa_job', <job_id>)` inside the IndexJob insert transaction, so notifications fire atomically with commit
- **DB access**: SQLAlchemy Core 2.0 (no ORM) + psycopg 3. Table definitions in `src/indexa_worker/schema.py` mirror Prisma names manually — `apps/server/prisma/schema.prisma` is source of truth
- **Queue**: Postgres `SELECT ... FOR UPDATE SKIP LOCKED`, no Redis
- **External deps**: Qdrant (vector store), DashScope QWEN `text-embedding-v3` (embeddings)
- **Shared filesystem**: must point to same `DOCUMENT_STORAGE_ROOT` as `apps/server`
- **Formats supported**: `.txt` / `.md` / `.pdf` (via pypdf)
- **Tests**: `tests/test_*.py`, pytest

### Data model (key entities)

Domain → Users, Libraries, EmbeddingProfiles. Library → Documents, UploadSessions, LibraryIndex → DocumentIndexState, IndexJob, DocumentChunk. All entities are domain-scoped (multi-tenant). `IndexJob` is the Node↔Python handoff point: server creates it QUEUED, worker flips it through RUNNING → SUCCEEDED/FAILED.

## Code Style

Enforced by Biome: 2-space indent, single quotes, no semicolons, trailing commas, 100-char line width. Arrow parens only as needed.

- kebab-case filenames, PascalCase for components/types
- Named exports only (default exports warned except config files)
- Conventional Commits: `feat(web):`, `fix(server):`, etc.
