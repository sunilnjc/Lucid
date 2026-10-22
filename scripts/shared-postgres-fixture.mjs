/** Isolated real PostgreSQL (WASM) fixture. Never connects to a hosted database. */
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export async function createSharedPostgresFixture(options = {}) {
  const modulePath = options.modulePath ?? process.env.PGLITE_MODULE_PATH;
  if (!modulePath) throw new Error('Set PGLITE_MODULE_PATH to an existing @electric-sql/pglite module in a temporary directory; this runner does not install dependencies.');
  const { PGlite } = await import(pathToFileURL(resolve(modulePath)).href);
  const notices = [];
  const db = new PGlite({ dataDir: 'memory://' });
  const onNotice = (notice) => notices.push(notice.message);
  const root = options.root ?? resolve(fileURLToPath(new URL('..', import.meta.url)));
  try {
    await db.exec(`
      set timezone = 'UTC';
      create role anon; create role authenticated;
      create schema auth;
      create table auth.users (id uuid primary key, aud text, role text, email text, created_at timestamptz, updated_at timestamptz);
      create function auth.uid() returns uuid language sql stable as $$
        select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
          nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'sub')::uuid
      $$;
      grant usage on schema auth to anon, authenticated;
      grant execute on function auth.uid() to anon, authenticated;
    `);
    for (const file of [
      'supabase/migrations/202609140001_lucid_accounts.sql',
      'supabase/proposals/202609140002_lucid_payload_validation.sql',
      ...(options.shared === false ? [] : ['supabase/proposals/202610140001_lucid_shared_progress.sql']),
    ]) await db.exec(await readFile(resolve(root, file), 'utf8'));
    return {
      db, notices, engine: (await db.query('select version() as version')).rows[0].version,
      exec: (sql) => db.exec(sql, { onNotice }), query: (sql, parameters) => db.query(sql, parameters, { onNotice }), close: () => db.close(),
    };
  } catch (error) { await db.close(); throw error; }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const fixture = await createSharedPostgresFixture({ shared: false });
  try {
    console.log(fixture.engine);
    const files = [
      'supabase/proposals/account-payload-security.sql',
      ...(!process.argv.includes('--legacy-only') ? ['supabase/proposals/202610140001_lucid_shared_progress.sql', 'supabase/proposals/shared-progress-security.sql'] : []),
    ];
    for (const file of files) {
      const results = await fixture.exec(await readFile(new URL(`../${file}`, import.meta.url), 'utf8'));
      console.log(`PASS ${file}`);
      for (const result of results) if (result.rows?.length) console.log(JSON.stringify(result.rows));
    }
    console.log(`${fixture.notices.filter((notice) => notice.startsWith('PASS')).length} SQL assertion notices passed.`);
  } catch (error) { try { await fixture.exec('rollback'); } catch { /* no live DB */ } console.error(`SQL verification failed: ${error.code ?? 'ERROR'} ${error.message}`); process.exitCode = 1; }
  finally { await fixture.close(); }
}
