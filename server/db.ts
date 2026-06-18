// SQLite connection (Node built-in node:sqlite — no native build step).
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Absolute path to the SQLite file. Override with APDA_DB_PATH. */
export const DB_PATH = process.env.APDA_DB_PATH
  ? resolve(process.env.APDA_DB_PATH)
  : resolve(__dirname, 'apda.db');

export const MIGRATIONS_DIR = resolve(__dirname, 'migrations');

let _db: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (_db) return _db;
  _db = new DatabaseSync(DB_PATH);
  _db.exec('PRAGMA journal_mode = WAL;');
  _db.exec('PRAGMA foreign_keys = ON;');
  return _db;
}

/** Read a JSON column, tolerating null/empty. */
export function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string' || value.length === 0) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
