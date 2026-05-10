/**
 * `BlockStore` implementation backed by `tauri-plugin-sql`. Mirrors the
 * Drizzle-side store in `@gnosis/db/client` so the same indexer code in
 * `@gnosis/core` runs in both environments.
 *
 * Inserts are batched per-call rather than per-row; tauri-plugin-sql does
 * not expose a multi-statement `execute` so we issue one INSERT per row
 * inside an explicit transaction for atomicity.
 */

import type { Block, BlockStore, NewBlock } from "@gnosis/db";
import { openDb } from "./db";

interface DbBlockRow {
	id: string;
	file_path: string;
	parent_id: string | null;
	level: number;
	headline_raw: string;
	todo_state: string | null;
	priority: string | null;
	scheduled: string | null;
	deadline: string | null;
	closed: string | null;
	body: string;
	start_byte: number;
	end_byte: number;
	updated_at: string;
}

const INSERT_SQL = `INSERT INTO blocks (
	id, file_path, parent_id, level, headline_raw, todo_state,
	priority, scheduled, deadline, closed, body, start_byte, end_byte
) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`;

export function createTauriBlockStore(): BlockStore {
	return {
		async upsertFileBlocks(filePath, rows) {
			const db = await openDb();
			await db.execute("BEGIN");
			try {
				await db.execute("DELETE FROM blocks WHERE file_path = $1", [filePath]);
				for (const r of rows) {
					await db.execute(INSERT_SQL, [
						r.id,
						r.filePath,
						r.parentId ?? null,
						r.level,
						r.headlineRaw,
						r.todoState ?? null,
						r.priority ?? null,
						r.scheduled ?? null,
						r.deadline ?? null,
						r.closed ?? null,
						r.body ?? "",
						r.startByte,
						r.endByte,
					] satisfies unknown[]);
				}
				await db.execute("COMMIT");
			} catch (err) {
				await db.execute("ROLLBACK");
				throw err;
			}
		},
		async deleteBlocksByFile(filePath) {
			const db = await openDb();
			await db.execute("DELETE FROM blocks WHERE file_path = $1", [filePath]);
		},
		async listBlockIdsByFile(filePath) {
			const db = await openDb();
			const rows = await db.select<{ id: string }[]>(
				"SELECT id FROM blocks WHERE file_path = $1",
				[filePath],
			);
			return rows.map((r) => r.id);
		},
		async getAllBlocks() {
			const db = await openDb();
			const rows = await db.select<DbBlockRow[]>("SELECT * FROM blocks");
			return rows.map(rowToBlock);
		},
	};
}

function rowToBlock(r: DbBlockRow): Block {
	return {
		id: r.id,
		filePath: r.file_path,
		parentId: r.parent_id,
		level: r.level,
		headlineRaw: r.headline_raw,
		todoState: r.todo_state as Block["todoState"],
		priority: r.priority as Block["priority"],
		scheduled: r.scheduled,
		deadline: r.deadline,
		closed: r.closed,
		body: r.body,
		startByte: r.start_byte,
		endByte: r.end_byte,
		updatedAt: r.updated_at,
	};
}

// `NewBlock` import retained for its type effects; row mapping uses the
// schema-inferred type via `Block`.
export type { NewBlock };
