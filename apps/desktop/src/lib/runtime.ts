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
	captureToVault,
	Indexer,
	type IndexResult,
	parseHeadline,
} from "@gnosis/core";
import type { Block } from "@gnosis/db";
import type { ViewBlock } from "@gnosis/views";
import { createTauriBlockStore } from "./block-store";
import { info as logInfo, warn as logWarn } from "./log";
import { TauriVault } from "./tauri-vault";

export interface DesktopRuntime {
	vault: TauriVault;
	indexer: Indexer;
	coldIndex(): Promise<IndexResult>;
	capture(kind: CaptureKind, text: string): Promise<{ filePath: string }>;
	loadViewBlocks(): Promise<ViewBlock[]>;
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
		async loadViewBlocks() {
			const rows = await store.getAllBlocks();
			return rows.map(rowToViewBlock);
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
