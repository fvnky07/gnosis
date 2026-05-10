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

// ---------------------------------------------------------------------------
// FTS search
// ---------------------------------------------------------------------------

export interface FtsRow {
	id: string;
	filePath: string;
	headlineRaw: string;
	snippet: string;
	rank: number;
}

export async function searchBlocks(
	query: string,
	limit = 50,
): Promise<FtsRow[]> {
	const trimmed = query.trim();
	if (!trimmed) return [];
	const db = await openDb();
	const sql = `
    SELECT b.id AS id,
           b.file_path AS filePath,
           b.headline_raw AS headlineRaw,
           snippet(blocks_fts, 1, '<mark>', '</mark>', '…', 32) AS snippet,
           bm25(blocks_fts) AS rank
    FROM blocks_fts
    JOIN blocks b ON b.rowid = blocks_fts.rowid
    WHERE blocks_fts MATCH ?
    ORDER BY rank
    LIMIT ?;
  `;
	return db.select<FtsRow[]>(sql, [trimmed, limit]);
}
