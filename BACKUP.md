# Independent encrypted backups

Status: tooling prepared, NOT activated. No remote repository or schedule has been configured.

Keep Supabase as the primary database. Enable its managed backups/PITR according
to the selected plan. The second copy uses restic encryption in a PRIVATE S3
repository under an independent provider/account. Do not use the public logo
bucket as the backup destination. Supabase database backups do not include
Storage object bytes, so the script exports store-logos separately.

## Runner

Use a dedicated trusted scheduled runner with Node 22, restic 0.18 or newer,
pg_dump matching the PostgreSQL server major version, and its trusted CA.
Do not run this inside a Vercel function. Do not put backup credentials in Vercel
or frontend variables. Configure runner secrets only:

- BACKUP_DATABASE_URL: Supabase direct/session endpoint with a backup account
  able to read every tenant. Not the transaction pooler. TLS is verify-full.
- PGSSLROOTCERT: trusted server CA path when the system CA is insufficient.
- SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_STORAGE_BUCKET=store-logos.
- RESTIC_REPOSITORY=s3:https://YOUR-INDEPENDENT-ENDPOINT/YOUR-PRIVATE-BUCKET/prefix
- RESTIC_PASSWORD: unique random password, at least 32 characters; keep a second
  offline copy in a password vault. Losing it makes backups unrecoverable.
- AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, optionally AWS_DEFAULT_REGION.

Initialize the chosen empty repository once with `restic init` after confirming
the destination. The backup command intentionally never initializes or deletes
repositories and never runs retention/prune or writes to the source database.

Run `node tooling/backup.mjs check-config`, then `node tooling/backup.mjs run`.
Database bytes and Storage JSONL stream directly to restic, without plaintext
files on disk. Two snapshots share the printed run tag; BOTH must exist. A failed
run is not a complete backup, even if a database snapshot was already saved.
Restrict runner logs: raw restic output may include private filenames.

Schedule daily initially, with monitoring that alerts on nonzero exit or no
successful run in 26 hours. Choose a shorter interval/PITR if losing up to 24
hours of changes is unacceptable. Schedule `node tooling/backup.mjs verify`
weekly; it downloads/checks encrypted data and may incur egress charges.
No scheduler is activated by this repository. Retention is intentionally disabled
until an approved policy exists; configure independent object versioning and
deletion protection with the storage provider, compatible with restic locks.

## Restore drill required before launch

Use `restic snapshots --tag RUN_TAG` to select BOTH exact snapshot IDs from a
successful run. Restore to an encrypted, access-restricted recovery directory
with `restic restore SNAPSHOT_ID --target RECOVERY_DIRECTORY`.
Never restore to production during a test. Never use `latest` without checking
the run tag and database/storage snapshot pair.

Provision a separate Supabase test project. Preserve the repository's migrations:
they define oh_app roles, grants, RLS, functions and financial protections not
fully represented in Prisma schema. The custom dump includes public-schema
objects/data but excludes managed Supabase schemas, cluster roles and ACLs;
it is an application recovery archive, not a full Supabase project clone.
An operator must plan restoration with the existing migrations and pg_restore,
using data-only restore into the migrated database where appropriate. Immutable
ledger triggers and foreign keys require a reviewed recovery procedure, not
blind SQL replay. Do not disable production protections.

The Storage file is newline-delimited JSON: header with bucket metadata,
records {path, contentType, data(base64)}, then {complete:true, objects:N}.
Recreate bucket settings and upload each decoded record under the same path in
the recovery project. Verify object count and bytes, and update test-only logo
URLs to the recovery project. A missing completion record invalidates the export.

Verify all entity counts, order/payment allocations, customer balances, ledger
sequence and audit chain, tenant isolation, login, and logo rendering. Record the
snapshot IDs, elapsed restore time, and results. Only a successful restore drill
proves recoverability. DB and Storage are captured sequentially, so suspend logo
replacement during a coordinated recovery-point backup when exact consistency
is required. Add any future buckets explicitly to backup coverage.
