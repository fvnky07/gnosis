/**
 * Hand-rolled DDL statements for the MVP schema.
 *
 * These are exported as plain strings so the runtime in `apps/desktop` can
 * execute them via `tauri-plugin-sql`, which does not consume Drizzle directly.
 * The same statements are applied to the in-memory adapter used by the
 * `packages/db` integration test (see `client.ts#applyMigrations`).
 *
 * When we adopt drizzle-kit, this file becomes the migration runner instead.
 */

export const CURRENT_SCHEMA_VERSION = 1;

export const CREATE_SCHEMA_VERSION_SQL = `CREATE TABLE IF NOT EXISTS schema_version (
  id INTEGER PRIMARY KEY,
  version INTEGER NOT NULL,
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;

export const CREATE_APP_STATE_SQL = `CREATE TABLE IF NOT EXISTS app_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;

export const CREATE_BLOCKS_SQL = `CREATE TABLE IF NOT EXISTS blocks (
  id TEXT PRIMARY KEY,
  file_path TEXT NOT NULL,
  parent_id TEXT,
  level INTEGER NOT NULL,
  headline_raw TEXT NOT NULL,
  todo_state TEXT,
  priority TEXT,
  scheduled TEXT,
  deadline TEXT,
  closed TEXT,
  body TEXT NOT NULL DEFAULT '',
  start_byte INTEGER NOT NULL,
  end_byte INTEGER NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;

/**
 * SQL statements run, in order, on every cold launch.
 * `IF NOT EXISTS` makes this idempotent.
 */
export const MIGRATIONS_SQL: ReadonlyArray<string> = [
	CREATE_SCHEMA_VERSION_SQL,
	CREATE_APP_STATE_SQL,
	CREATE_BLOCKS_SQL,
];

/** Upsert the schema_version row. Runs after the CREATEs. */
export const SEED_SCHEMA_VERSION_SQL = `INSERT OR IGNORE INTO schema_version (id, version) VALUES (1, ${CURRENT_SCHEMA_VERSION})`;
