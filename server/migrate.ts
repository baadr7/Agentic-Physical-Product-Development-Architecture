// Migration runner. Applies server/migrations/*.sql in filename order, tracking
// applied versions in schema_migrations. `--reset` drops the DB file first.
import { readFileSync, readdirSync, existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { getDb, MIGRATIONS_DIR, DB_PATH } from './db.ts';

function reset() {
  for (const suffix of ['', '-wal', '-shm']) {
    const f = DB_PATH + suffix;
    if (existsSync(f)) rmSync(f);
  }
  console.log('[migrate] reset: removed', DB_PATH);
}

export function migrate(): string[] {
  const db = getDb();
  db.exec(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       version TEXT PRIMARY KEY,
       applied_at TEXT NOT NULL DEFAULT (datetime('now'))
     );`,
  );
  const applied = new Set(
    db.prepare('SELECT version FROM schema_migrations').all().map((r: any) => r.version as string),
  );
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  const ran: string[] = [];
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(resolve(MIGRATIONS_DIR, file), 'utf8');
    db.exec(sql);
    db.prepare('INSERT INTO schema_migrations (version) VALUES (?)').run(file);
    ran.push(file);
    console.log('[migrate] applied', file);
  }
  if (ran.length === 0) console.log('[migrate] up to date');
  return ran;
}

// Run when invoked directly (tsx server/migrate.ts [--reset]).
if (process.argv[1] && process.argv[1].includes('migrate')) {
  if (process.argv.includes('--reset')) reset();
  migrate();
}
