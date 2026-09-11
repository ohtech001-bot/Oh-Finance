# Production readiness review - 2026-09-12

Decision: do not open paid/live onboarding yet. Local improvements are prepared;
deployment, independent backup activation, restore drill and isolated financial
integration testing remain required. This is a code/configuration review, not a
penetration-test certificate or a guarantee against compromise.

## Verified

- Read-only inspection of the Supabase database selected by local DATABASE_URL:
  21 application tables have enabled AND forced RLS; oh_app is neither superuser
  nor BYPASSRLS. This does not prove the Vercel environment points at this same DB.
- All 13 recorded migrations completed, none rolled back.
- Immutability triggers enabled for audit_logs, ledger_entries,
  payment_allocations and confirmed orders/items.
- Code uses HttpOnly auth cookies, CSRF verification, role/permission guards,
  tenant context, password hashing, and Redis-backed rate limiting.
- Service worker does not cache API/financial data. Tracked environment files
  are examples, not actual .env files. Not a full git-history secret scan.
- Production /api/health/live and /api/health returned HTTP 200 on this review.
  These checks are unauthenticated and do not validate login or transactions.
- 204 tests passed; 142 database tests skipped deliberately. Tests include
  permissions, input validation, Redis failure handling and Storage validation.
- Typecheck passed. See current build/lint results in the delivery report.

## Local changes

- Compatible dependency updates for routing, YAML, brace expansion, query
  parsing and NestJS. Nodemailer updated to 10.0.8 to address published findings.
  SMTP delivery must still be tested against the real provider.
- API responses now use Cache-Control: no-store.
- Browser CSP permits public Supabase Storage logo paths without allowing
  arbitrary scripts. Print buttons use event listeners instead of inline JS
  blocked by production CSP.
- Destructive integration tests require ALLOW_TEST_DB_RESET=true and reject a
  database matching the application endpoint or Supabase project identity.
- Read-only inspection tool: node --env-file=.env tooling/check-production-db.mjs.
- Encrypted backup tooling and instructions in BACKUP.md. No backup repository,
  scheduler or credentials have been configured. No data was exported.

## Release blockers

1. npm audit still reports 7 high findings via TWO underlying dependencies:
   multer 2.2.0 (Nest platform adapter pins it) and deepmerge-ts 7.1.5
   (Prisma configuration toolchain). No forced Nest downgrade or Prisma major
   migration was applied. Resolve with verified compatible upstream versions
   or a tested dependency override, then rerun audit and upload/boot tests.
   Severity is a dependency advisory, not proof of a reachable application exploit.
2. Choose independent private S3/R2 account, install restic/pg_dump on a trusted
   runner, configure encrypted backups, alerting and retention, and perform an
   isolated database plus Storage restoration. Tooling alone is not a second copy.
3. Verify Supabase managed backup/PITR plan, retention, and actual recovery
   points. Provider DB backups exclude Storage file bytes.
4. Provision an isolated test database and run all 142 database tests after
   reviewing reset authorization. They truncate test tables; never use production.
5. Verify Vercel Production secrets, HTTPS cookie options, TLS Redis, Supabase
   identity/region, SMTP resets, and live login-refresh-logout-login on Preview.
6. Run authenticated end-to-end owner/super-admin tests: tenant isolation,
   duplicate payments, credit allocation, concurrent confirmation, financial
   totals, logo upload, printing and PDF sharing under production CSP.
7. Enable MFA on Vercel/Supabase/GitHub/backup-provider administrator accounts,
   restrict team access, and configure error/uptime/backup failure alerts. These
   account settings were not inspected or changed.

## Recovery expectations

An independently administered encrypted backup protects against loss of the
primary project; it is not synchronous replication. A daily schedule can lose
up to a day of changes. Choose an explicit recovery-point target and recovery
time target, then measure both in the restore drill. Keep encryption-key recovery
outside the primary hosting account. See BACKUP.md for limitations and procedure.

References:
- https://supabase.com/docs/guides/platform/backups
- https://restic.readthedocs.io/en/stable/040_backup.html

No production data, schema, migrations or RLS were modified during this review.
No commit, push, deployment, external message or backup upload was performed.
