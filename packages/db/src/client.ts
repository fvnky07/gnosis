import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { MIGRATIONS_SQL, SEED_SCHEMA_VERSION_SQL } from "./migrations";
import { appState, blocks, schemaVersion } from "./schema";

export type GnosisDb = ReturnType<typeof drizzle>;

export function createInMemoryDb(): GnosisDb {
	const sqlite = new Database(":memory:");
	const db = drizzle(sqlite);
	applyMigrations(db);
	return db;
}

/**
 * Apply the MVP DDL to the supplied Drizzle handle. Re-runnable: every
 * statement uses `IF NOT EXISTS` and the schema-version seed is `INSERT OR
 * IGNORE`. Used by the in-memory adapter for tests and by any node-side
 * tooling that wants the schema without going through Tauri.
 */
export function applyMigrations(db: GnosisDb) {
	for (const ddl of MIGRATIONS_SQL) {
		db.run(ddl);
	}
	db.run(SEED_SCHEMA_VERSION_SQL);
}

export { appState, blocks, schemaVersion };
