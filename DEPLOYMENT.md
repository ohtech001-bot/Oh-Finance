# Deployment (Vercel)

Before public launch, review `PRODUCTION-READINESS.md` and complete the independent
backup activation and restoration checks in `BACKUP.md`. Prepared tooling is not
evidence of an active backup.

The production web application and NestJS API are deployed from one Vercel
Services project. This keeps browser requests, authentication cookies, and CSRF
checks on the same origin while allowing Vercel to build each framework with its
native adapter.

## Project settings

- Repository: this monorepo
- Root Directory: repository root
- Framework Preset: Services
- Node.js: 20.x or 22.x
- Service definitions and public routing: use the root `vercel.json`

The `web` service builds `apps/web` with Vite. The `api` service builds
`apps/api` with Vercel's NestJS adapter and recognizes `src/main.mts` as its
entrypoint. Top-level service rewrites route `/api/*` to NestJS and all remaining
paths to the web service. The original request path is preserved, including the
existing `/api` global prefix.

`apps/api/vercel.json` and `apps/web/vercel.json` are retained as inactive legacy
per-app configurations. Do not create a second Vercel project from either app
while the combined Services project is in use.

## Required environment variables

Set these in Vercel for Production and Preview as appropriate:

- `NODE_ENV=production`
- `DATABASE_URL`: Supabase PostgreSQL connection URL
- `DIRECT_DATABASE_URL`: Supabase direct/session connection used by Prisma
  migration tooling; migrations are not run by the application function
- `WEB_ORIGIN`: the exact public HTTPS origin of this Vercel project
- `JWT_ACCESS_SECRET`: unique random value of at least 32 characters
- `JWT_REFRESH_SECRET`: different unique random value of at least 32 characters
- `COOKIE_SECRET`: unique random value of at least 32 characters
- `COOKIE_SECURE=true`
- `COOKIE_SAME_SITE=lax`
- `SUPABASE_URL`: Supabase project URL used by server-side Storage requests
- `SUPABASE_SERVICE_ROLE_KEY`: server-only Storage credential; never expose it as `VITE_*`
- `SUPABASE_STORAGE_BUCKET=store-logos`
- `REDIS_URL`: TLS Redis connection shared by every Vercel runtime
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`
- `SMTP_FROM_EMAIL`, `SMTP_FROM_NAME`

Leave `COOKIE_DOMAIN` unset for host-only, same-origin cookies unless a custom
domain design explicitly requires it. Never expose database, JWT, cookie, Redis,
or SMTP secrets as `VITE_*` variables.

## Database

Prisma remains the only application database client. The schema and migrations
remain under `apps/api/prisma`. `DATABASE_URL` must point to Supabase only.

The current Supabase Session Pooler URL works with this application, including
its interactive transactions, `SET LOCAL ROLE`, RLS context, and advisory-lock
logic. Serverless concurrency can create more database connections, so changing
to Supabase Transaction Pooler must be tested separately before replacing the
connection string.

## Serverless constraints

- Vercel's NestJS adapter deploys the application as one Function and reuses the
  warm runtime. `PrismaService` owns one client per Nest application instance;
  cold runtimes still create a fresh container and connection.
- Throttling uses Redis through `@nest-lab/throttler-storage-redis`. API startup
  fails in production when Redis is not configured or cannot be reached, and a
  runtime Redis failure denies the request with HTTP 503 instead of silently
  bypassing rate limits.
- Store logos are stored in the public Supabase Storage bucket `store-logos`.
  The API creates or verifies the bucket before the first upload, accepts only
  PNG/JPEG/WebP up to 5 MiB, and stores only the resulting public URL in Prisma.
- No WebSocket gateway, in-process cron, background worker, or backend
  `setInterval` is currently present.

## Verification

Before promoting a deployment, verify:

1. `GET /api/health/live` returns HTTP 200.
2. `GET /api/health` returns HTTP 200 and reports the database as available.
3. Login, refresh, logout, and a CSRF-protected write work on the Vercel origin.
4. A normal authenticated Prisma request respects tenant RLS.
5. Upload, replace, and remove a store logo; confirm the public URL is served
   from Supabase Storage and remains available after a fresh deployment.
6. Send requests through at least two warm runtimes and confirm they increment
   the same Redis-backed rate-limit counter.
7. Vercel function logs contain no secrets.
