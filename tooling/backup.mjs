import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';

// Run on a dedicated backup runner, never inside a Vercel request.
const mode = process.argv[2] ?? 'check-config';
const required = (key) => {
  if (!process.env[key]) throw new Error(`Missing ${key}`);
  return process.env[key];
};

function configuration() {
  const source = new URL(required('BACKUP_DATABASE_URL'));
  if (!['postgres:', 'postgresql:'].includes(source.protocol))
    throw new Error('Invalid database protocol');
  if (!source.hostname.endsWith('.supabase.co') && !source.hostname.endsWith('.supabase.com')) {
    throw new Error('Backup source must be Supabase');
  }
  const storage = new URL(required('SUPABASE_URL'));
  if (storage.protocol !== 'https:') throw new Error('Storage requires HTTPS');
  required('SUPABASE_SERVICE_ROLE_KEY');
  const repository = required('RESTIC_REPOSITORY');
  if (!repository.startsWith('s3:https://'))
    throw new Error('Use an independent HTTPS S3 repository');
  if (required('RESTIC_PASSWORD').length < 32)
    throw new Error('RESTIC_PASSWORD must have at least 32 characters');
  required('AWS_ACCESS_KEY_ID');
  required('AWS_SECRET_ACCESS_KEY');
  return {
    storage,
    env: {
      ...process.env,
      PGHOST: source.hostname,
      PGPORT: source.port || '5432',
      PGUSER: decodeURIComponent(source.username),
      PGPASSWORD: decodeURIComponent(source.password),
      PGDATABASE: decodeURIComponent(source.pathname.slice(1)),
      PGSSLMODE: 'verify-full',
      PGCONNECT_TIMEOUT: '30',
    },
  };
}

async function run(command, args, env) {
  // Child errors can contain connection strings or object names; don't relay them.
  const child = spawn(command, args, { env, shell: false, stdio: ['ignore', 'ignore', 'ignore'] });
  const [code] = await once(child, 'exit');
  if (code !== 0) throw new Error(`${command} failed; exit ${code}`);
}

async function exportStorage(storage) {
  const key = required('SUPABASE_SERVICE_ROLE_KEY');
  const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'store-logos';
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };
  const request = async (path, options = {}) => {
    const response = await fetch(new URL(`/storage/v1/${path}`, storage), {
      ...options,
      headers,
      redirect: 'error',
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok) throw new Error(`Storage export failed: HTTP ${response.status}`);
    return response;
  };
  const write = async (record) => {
    if (!process.stdout.write(`${JSON.stringify(record)}\n`)) await once(process.stdout, 'drain');
  };
  const bucketInfo = await (await request(`bucket/${encodeURIComponent(bucket)}`)).json();
  await write({
    format: 'oh-storage-v1',
    bucket: bucketInfo,
    capturedAt: new Date().toISOString(),
  });
  const folders = [''];
  let objects = 0;
  while (folders.length) {
    const prefix = folders.shift();
    for (let offset = 0; ; offset += 100) {
      const list = await (
        await request(`object/list/${encodeURIComponent(bucket)}`, {
          method: 'POST',
          body: JSON.stringify({
            prefix,
            limit: 100,
            offset,
            sortBy: { column: 'name', order: 'asc' },
          }),
        })
      ).json();
      if (!Array.isArray(list)) throw new Error('Invalid Storage listing');
      for (const item of list) {
        const path = prefix ? `${prefix}/${item.name}` : item.name;
        if (!item.id) {
          folders.push(path);
          continue;
        }
        const response = await request(
          `object/authenticated/${encodeURIComponent(bucket)}/${path.split('/').map(encodeURIComponent).join('/')}`,
        );
        const chunks = [];
        let size = 0;
        for await (const chunk of response.body) {
          size += chunk.length;
          if (size > 10 * 1024 * 1024) throw new Error('Logo exceeds backup size limit');
          chunks.push(Buffer.from(chunk));
        }
        await write({
          path,
          contentType: response.headers.get('content-type'),
          data: Buffer.concat(chunks).toString('base64'),
        });
        objects++;
      }
      if (list.length < 100) break;
    }
  }
  await write({ complete: true, objects });
}

try {
  if (mode === 'export-storage') {
    await exportStorage(new URL(required('SUPABASE_URL')));
  } else {
    const { env } = configuration();
    if (mode === 'check-config') {
      console.log('Backup configuration present. No network access or data copied.');
    } else if (mode === 'run') {
      const tag = `oh-finance-${new Date().toISOString().replaceAll(':', '-')}`;
      await run('restic', ['snapshots', '--json'], env);
      await run(
        'restic',
        [
          'backup',
          '--tag',
          tag,
          '--tag',
          'database',
          '--stdin-filename',
          'postgres.dump',
          '--stdin-from-command',
          '--',
          'pg_dump',
          '--format=custom',
          '--schema=public',
          '--no-owner',
          '--no-privileges',
        ],
        env,
      );
      await run(
        'restic',
        [
          'backup',
          '--tag',
          tag,
          '--tag',
          'storage',
          '--stdin-filename',
          'store-logos.jsonl',
          '--stdin-from-command',
          '--',
          process.execPath,
          fileURLToPath(import.meta.url),
          'export-storage',
        ],
        env,
      );
      await run('restic', ['check'], env);
      console.log(`Backup completed and repository metadata checked. Tag: ${tag}`);
    } else if (mode === 'verify') {
      await run('restic', ['check', '--read-data'], env);
      console.log(
        'Encrypted repository data verification passed. A database restore drill is still required.',
      );
    } else {
      throw new Error('Use check-config, run, or verify');
    }
  }
} catch (error) {
  // Never print raw network/database errors or credentials.
  const safe =
    error instanceof Error &&
    /^(Missing |Invalid database|Backup source|Storage requires|Use an independent|RESTIC_PASSWORD|Use check-config)/.test(
      error.message,
    );
  console.error(
    safe ? error.message : 'Backup failed. No complete backup confirmed; alert the operator.',
  );
  process.exitCode = 1;
}
