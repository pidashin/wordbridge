# Project: Word Bridge

Standalone vocabulary-learning app, extracted from `pidashin/portfolio`
(`app/projects/wordbridge/`). This repo is **public**.

## Tech Stack

- Next.js (App Router) + React + TypeScript
- GraphQL: Apollo Server (`@apollo/server`, `@as-integrations/next`) +
  Apollo Client (`@apollo/client`, `graphql-tag`)
- Prisma (`@prisma/client` + `@prisma/adapter-libsql`) over SQLite (`@libsql/client`) —
  exam history only (`User`, `ExamHistory` models)
- Hugging Face Inference API (`@huggingface/inference`) — AI quiz template generation
- Tailwind CSS, ESLint (`next/core-web-vitals` + Prettier), Prettier
- Docker for deployment

## Commands

- Dev: `npm run dev`
- Build: `npm run build`
- Lint: `next lint`
- Prisma: `npx prisma generate` / `npx prisma db push`

No automated test suite exists yet.

## Code Conventions

- App Router structure under `app/` (mirrors the original `app/projects/wordbridge/`
  layout, now at the repo root instead of nested under a `projects/` path).
- GraphQL queries/mutations live in `gql/`; the Apollo server resolver lives in
  `api/graphql/route.ts`.
- `api/db.ts` is the single Prisma client instance (`globalForPrisma` pattern to
  avoid hot-reload duplication).
- Prettier: single quotes, semicolons, trailing commas, 80-char width.

## Boundaries

- **This repo is PUBLIC — security is the top priority. Never commit `.env*`
  files, API keys, database files (`dev.db`), or real user-submitted data**
  (e.g. `word_flags.json` — runtime data, gitignored, seed `words.json` /
  `words_ai.json` are fine, they're vocabulary content not user data).
- Never reference infrastructure details (NAS IP, port, SSH host, credentials)
  in code, commits, issues, or this file — even indirectly. If a deploy config
  needs a value like that, it belongs in an untracked `.env.local` /
  docker-compose environment override, never hardcoded or committed.
- Ask before modifying `prisma/schema.prisma`, Docker/deploy config, or
  anything that would touch production data once this is deployed.
- Touch only what the task asks for.
- Verify external APIs (Hugging Face, Prisma, Apollo) against official docs
  before use — don't guess method signatures.

## Domain Knowledge

- No dedicated knowledge store yet (mirrors `pidashin/portfolio`, which also
  has none) — this is a small personal project. Revisit if it grows.
- Dev-flow: see `.claude/skills/wordbridge-dev-flow/SKILL.md` (or ask Claude
  to run `/init` again later if this file needs a formal knowledge store).

## Origin

This code was copied from `pidashin/portfolio` (`app/projects/wordbridge/`)
on 2026-09-21 as part of a project-separation effort. The portfolio repo was
left unmodified during the copy; duplicated code there will be removed in a
later, separate step once this standalone app is verified working.
