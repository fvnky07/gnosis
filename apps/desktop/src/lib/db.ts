/**
 * SQLite bootstrap for the gnosis desktop runtime.
 *
 * Opens `gnosis.sqlite` in the OS app-data directory via `tauri-plugin-sql`
 * (the SQL plugin resolves `sqlite:<name>` against `$APP_DATA` automatically),
 * runs the hand-rolled migrations from `@gnosis/db`, and seeds the schema-
 * version row. The returned handle is reused for the lifetime of the window.
 */

import {
	CURRENT_SCHEMA_VERSION,
	MIGRATIONS_SQL,
	SEED_SCHEMA_VERSION_SQL,
} from "@gnosis/db/migrations";
import Database from "@tauri-apps/plugin-sql";

const SQLITE_URI = "sqlite:gnosis.sqlite";

let dbPromise: Promise<Database> | null = null;

export async function openDb(): Promise<Database> {
	if (!dbPromise) {
		dbPromise = (async () => {
			const db = await Database.load(SQLITE_URI);
			for (const ddl of MIGRATIONS_SQL) {
				await db.execute(ddl);
			}
			await db.execute(SEED_SCHEMA_VERSION_SQL);
			return db;
		})();
	}
	return dbPromise;
}

export async function readSchemaVersion(): Promise<number | null> {
	const db = await openDb();
	const rows = await db.select<{ version: number }[]>(
		"SELECT version FROM schema_version WHERE id = 1",
	);
	return rows[0]?.version ?? null;
}

export { CURRENT_SCHEMA_VERSION };
