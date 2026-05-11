/**
 * Glue layer for the desktop write-back loop. Owns the `Vault`, `BlockStore`,
 * and `Indexer` singletons, and exposes the high-level operations the UI
 * binds to:
 *
 *   - `coldIndex()`  — palette `Refresh index` + first-launch warmup
 *   - `capture(kind, text)` — palette capture providers
 *   - `loadViewBlocks()` — query SQLite into the right-sidebar's prop shape
 *
 * All file IO flows through `@gnosis/core`. The runtime only owns wiring
 * and the per-row → `ViewBlock` adapter (parsing tags out of the headline
 * since the schema doesn't persist them yet).
 */

import {
	type CaptureKind,
	captureScheduledToVault,
	captureToVault,
	dailyNotePath,
	Indexer,
	type IndexResult,
	parseHeadline,
	type ScheduledCaptureInput,
	type ScheduledCaptureResult,
	VaultNotFoundError,
} from "@gnosis/core";
import type { Block } from "@gnosis/db";
import type { ViewBlock } from "@gnosis/views";
import { createTauriBlockStore } from "./block-store";
import { searchBlocks as dbSearchBlocks, type FtsRow, openDb } from "./db";
import { info as logInfo, warn as logWarn } from "./log";
import { TauriVault } from "./tauri-vault";

export type { FtsRow };

export interface DesktopRuntime {
	vault: TauriVault;
	indexer: Indexer;
	coldIndex(): Promise<IndexResult>;
	capture(kind: CaptureKind, text: string): Promise<{ filePath: string }>;
	captureScheduled(
		input: Omit<ScheduledCaptureInput, "todayDailyPath">,
	): Promise<ScheduledCaptureResult>;
	openDailyNote(now?: Date): Promise<{
		filePath: string;
		doc: string;
		fileCreated: boolean;
	}>;
	loadViewBlocks(): Promise<ViewBlock[]>;
	searchBlocks(query: string, limit?: number): Promise<FtsRow[]>;
	listFiles(
		query: string,
	): Promise<Array<{ path: string; title: string; preview?: string }>>;
	listOutline(filePath: string | null): Promise<
		Array<{
			id: string;
			filePath: string;
			level: number;
			headline: string;
			line: number;
		}>
	>;
	listTabs(): Promise<
		Array<{ id: string; filePath: string; title: string; active?: boolean }>
	>;
	openFile(path: string): Promise<string>;
	openBlock(
		blockId: string,
	): Promise<{ filePath: string; line: number } | null>;
}

export function createRuntime(vaultPath: string): DesktopRuntime {
	const vault = new TauriVault(vaultPath);
	const store = createTauriBlockStore();
	const logger = {
		info: (m: string) => {
			void logInfo(m);
		},
		warn: (m: string) => {
			void logWarn(m);
		},
	};
	const indexer = new Indexer(vault, store, logger);

	return {
		vault,
		indexer,
		async coldIndex() {
			return await indexer.cold();
		},
		async capture(kind, text) {
			const result = await captureToVault(vault, kind, text);
			await indexer.incremental(result.filePath);
			return { filePath: result.filePath };
		},
		async captureScheduled(input) {
			const now = input.createdAt ?? new Date();
			const result = await captureScheduledToVault(vault, {
				...input,
				createdAt: now,
				todayDailyPath: dailyNotePath(now),
			});
			await indexer.incremental(result.filePath);
			return result;
		},
		async openDailyNote(now = new Date()) {
			const filePath = dailyNotePath(now);
			await vault.ensureDir("daily");
			let doc: string;
			let fileCreated = false;
			try {
				doc = await vault.read(filePath);
			} catch (err) {
				if (!(err instanceof VaultNotFoundError)) throw err;
				const yyyy = now.getFullYear();
				const mm = String(now.getMonth() + 1).padStart(2, "0");
				const dd = String(now.getDate()).padStart(2, "0");
				doc = `#+TITLE: ${yyyy}-${mm}-${dd}\n`;
				await vault.write(filePath, doc);
				await indexer.incremental(filePath);
				fileCreated = true;
			}
			return { filePath, doc, fileCreated };
		},
		async loadViewBlocks() {
			const rows = await store.getAllBlocks();
			return rows.map(rowToViewBlock);
		},

		// -----------------------------------------------------------------------
		// Phase 6 executors
		// -----------------------------------------------------------------------

		async searchBlocks(query, limit) {
			return dbSearchBlocks(query, limit);
		},

		async listFiles(query) {
			const files = await vault.list();
			const lq = query.trim().toLowerCase();
			return files
				.filter((f) => {
					if (!lq) return true;
					return f.path.toLowerCase().includes(lq);
				})
				.map((f) => {
					const basename = f.path.split("/").pop() ?? f.path;
					const title = basename.endsWith(".org")
						? basename.slice(0, -4)
						: basename;
					return { path: f.path, title };
				});
		},

		async listOutline(filePath) {
			if (!filePath) return [];
			let contents: string;
			try {
				contents = await vault.read(filePath);
			} catch (err) {
				void logWarn(
					`listOutline: could not read "${filePath}": ${String(err)}`,
				);
				return [];
			}
			const lines = contents.split("\n");
			const result: Array<{
				id: string;
				filePath: string;
				level: number;
				headline: string;
				line: number;
			}> = [];
			const headingRe = /^(\*+)\s+(.+)$/;
			for (let i = 0; i < lines.length && result.length < 500; i++) {
				const m = headingRe.exec(lines[i]);
				if (m) {
					result.push({
						id: `${filePath}:${i}`,
						filePath,
						level: m[1].length,
						headline: m[2],
						line: i,
					});
				}
			}
			return result;
		},

		async listTabs() {
			// TODO(Wave 2 merger): App.tsx will inject active-tab state via a
			// handler override. For MVP, return empty so callers degrade gracefully.
			return [];
		},

		async openFile(path) {
			return vault.read(path);
		},

		async openBlock(blockId) {
			const db = await openDb();
			const rows = await db.select<{ file_path: string; start_byte: number }[]>(
				"SELECT file_path, start_byte FROM blocks WHERE id = $1 LIMIT 1",
				[blockId],
			);
			if (!rows[0]) return null;
			return { filePath: rows[0].file_path, line: 0 };
		},
	};
}

function rowToViewBlock(row: Block): ViewBlock {
	const parsed = parseHeadline(row.headlineRaw);
	return {
		id: row.id,
		filePath: row.filePath,
		level: row.level,
		headlineRaw: row.headlineRaw,
		body: row.body,
		todoState:
			row.todoState === "TODO" || row.todoState === "DONE"
				? row.todoState
				: null,
		priority:
			row.priority === "A" || row.priority === "B" || row.priority === "C"
				? row.priority
				: null,
		scheduled: row.scheduled,
		deadline: row.deadline,
		closed: row.closed,
		tags: parsed?.tags ?? [],
	};
}
