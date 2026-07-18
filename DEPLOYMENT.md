# Deployment (Vercel) — oh-finance monorepo

npm-workspaces monorepo. `apps/api` and `apps/web` import the internal packages
`@oh/money`, `@oh/config`, `@oh/contracts` (built to `dist/`) and `@oh/ui`
(consumed as source by Vite). The Vercel failure was **build order**: Vercel
built an app in isolation (`nest build` / `vite build`) without first building
those packages, so `@oh/*` (whose `package.json main → dist/index.js`) could not
be resolved. This is now fixed **in configuration only — no application code was
changed.**

## What was changed
- **Root `package.json` scripts** (build order made explicit and self-contained):
  - `build:packages` → builds `@oh/money`, `@oh/config`, `@oh/contracts` (dist).
  - `build:api` → `build:packages` then `nest build` (→ `apps/api/dist`).
  - `build:web` → `build:packages`, then `tsc -b tsconfig.web.json` (type-builds
    libs + `@oh/ui` so the web's `tsc -b --noEmit` is a no-op — avoids TS6310),
    then `vite build` (→ `apps/web/dist`).
  - `build` → `build:api && build:web` (both self-contained; works from a clean
    clone without needing `typecheck` first).
- **`tsconfig.web.json`** — web-only solution project (libs + `apps/web`, **not**
  `apps/api`), so a web deploy never depends on Prisma/the server.
- **`apps/api/vercel.json`**, **`apps/web/vercel.json`** — per-app build config.
- **`postinstall` → `tooling/prisma-postinstall.mjs`** — generates Prisma Client
  using only the **locally-installed pinned** Prisma (6.19.3), never `npx`-
  downloads a newer version, and **skips entirely when `SKIP_PRISMA_GENERATE=1`**
  (set by the web deploy). The old fallback that ran `npx prisma` (which pulled
  `prisma@latest`) was removed. The API deploy's install runs it normally →
  pinned 6.19.3.

Internal package `main`/`types`/`exports`/`files` and tsconfig project
references were already correct and were left unchanged.

## Web — `apps/web` (fully deployable on Vercel)
Create a Vercel project pointed at this repo with:
- **Root Directory:** `apps/web`
- Build/Install/Output come from `apps/web/vercel.json`:
  - `buildCommand`: `cd ../.. && npm run build:web`
  - `outputDirectory`: `dist`
  - SPA fallback rewrite to `/index.html`
- Install runs at the workspace root automatically (npm workspaces). The web
  `installCommand` sets **`SKIP_PRISMA_GENERATE=1`**, so the root `postinstall`
  **does not run Prisma at all** on the web deploy (no accidental download of a
  newer Prisma).
- Set any `VITE_*` runtime env vars (e.g. API base URL) in the Vercel project.

Result: a static SPA — builds and serves correctly.

## API — `apps/api` (build fixed; runtime needs a Node host)
`apps/api/vercel.json` makes the **build succeed** on Vercel
(`cd ../.. && npm run build:api`). However, **NestJS is a long-running HTTP
server, and Vercel is serverless/static** — it cannot run `node dist/main.js`.
So the build passes, but Vercel cannot *serve* the API as-is.

To actually run the API, pick one (both are out of scope of "no app-code
changes", so they are recommendations, not applied):
1. **Deploy the API on a Node host** — Railway (already used for the DB),
   Render, or Fly.io. Start command: `npm run build:api && npm run start -w @oh/api`.
   This is the recommended fit for NestJS.
2. **Add a Vercel serverless entry** — a thin handler that boots the Nest app
   (e.g. `apps/api/api/index.ts` with `serverless-express`). This is new
   deployment glue (app-adjacent code); say the word and it can be added.

## Node version
Root `engines.node` is `>=20.11.0` and `.npmrc` has `engine-strict=true`. Ensure
the Vercel project uses **Node 20.x or 22.x** (both satisfy the range; this is
Vercel's default).

## Independence
Each app is its own Vercel project (different **Root Directory**), so they build
and deploy independently. No manual build commands are needed — the `vercel.json`
files encode everything; Vercel just needs the Root Directory set per project.
