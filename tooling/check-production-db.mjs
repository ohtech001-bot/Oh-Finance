import { PrismaClient } from '@prisma/client';

const db = new PrismaClient({ log: [] });
try {
  const url = new URL(process.env.DATABASE_URL || '');
  if (!url.hostname.endsWith('.supabase.co') && !url.hostname.endsWith('.supabase.com')) {
    throw new Error('Invalid source');
  }
  const result = await db.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      const tables = await tx.$queryRaw`
      SELECT c.relname AS name, c.relrowsecurity AS rls, c.relforcerowsecurity AS forced,
        (SELECT count(*)::int FROM pg_policy p WHERE p.polrelid=c.oid) AS policies
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND c.relkind='r' ORDER BY c.relname`;
      const roles = await tx.$queryRaw`
      SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname='oh_app'`;
      const migrations = await tx.$queryRaw`
      SELECT migration_name, finished_at IS NOT NULL AS completed,
      rolled_back_at IS NOT NULL AS rolled_back FROM public._prisma_migrations ORDER BY started_at`;
      const triggers = await tx.$queryRaw`
      SELECT c.relname AS table_name, t.tgname AS name, t.tgenabled AS enabled
      FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
      JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='public' AND NOT t.tgisinternal ORDER BY c.relname,t.tgname`;
      return { tables, roles, migrations, triggers };
    },
    { timeout: 30_000 },
  );
  console.log(JSON.stringify(result, null, 2));
} catch {
  console.error('Read-only database verification failed. No customer data or secrets printed.');
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
