import Database from "better-sqlite3";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { MIGRATIONS_SQL, SEED_SCHEMA_VERSION_SQL } from "./migrations";
import {
	appState,
	type Block,
	blocks,
	type NewBlock,
	schemaVersion,
} from "./schema";
import type { BlockStore } from "./store";

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

/**
 * Node-side {@link BlockStore} implementation backed by a Drizzle handle.
 * Used by the indexer's tests via `createInMemoryDb()`. The desktop runtime
 * gets its own implementation against `tauri-plugin-sql` — both consume the
 * `BlockStore` interface from `@gnosis/db/store`.
 */
export function createDrizzleBlockStore(db: GnosisDb): BlockStore {
	return {
		async upsertFileBlocks(filePath: string, rows: NewBlock[]): Promise<void> {
			db.delete(blocks).where(eq(blocks.filePath, filePath)).run();
			if (rows.length > 0) {
				db.insert(blocks).values(rows).run();
			}
		},
		async deleteBlocksByFile(filePath: string): Promise<void> {
			db.delete(blocks).where(eq(blocks.filePath, filePath)).run();
		},
		async listBlockIdsByFile(filePath: string): Promise<string[]> {
			const rows = db
				.select({ id: blocks.id })
				.from(blocks)
				.where(eq(blocks.filePath, filePath))
				.all();
			return rows.map((r) => r.id);
		},
		async getAllBlocks(): Promise<Block[]> {
			return db.select().from(blocks).all();
		},
	};
}

export { appState, blocks, schemaVersion };
