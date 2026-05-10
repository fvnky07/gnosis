import type { Block, NewBlock } from "./schema";

/**
 * Browser-safe abstraction over the `blocks` table. The desktop runtime
 * implements this against `tauri-plugin-sql`; node-side tests implement it
 * against `better-sqlite3` (see {@link createDrizzleBlockStore} in
 * `./client.ts`). The indexer in `@gnosis/core` consumes only this interface
 * so the same orchestration code runs in both environments.
 *
 * Keep this file free of node-only imports — the desktop bundle pulls it in
 * via `@gnosis/db/store`, and we don't want better-sqlite3 stubs leaking
 * into the browser build.
 */
export interface BlockStore {
	/**
	 * Replace every block row associated with `filePath`. Atomic from the
	 * caller's view: existing rows for the file are deleted and the new rows
	 * inserted, so stale blocks never linger when a file shrinks.
	 */
	upsertFileBlocks(filePath: string, rows: NewBlock[]): Promise<void>;
	/** Remove every block row for the given file path. */
	deleteBlocksByFile(filePath: string): Promise<void>;
	/** Return the IDs of all blocks currently associated with the file. */
	listBlockIdsByFile(filePath: string): Promise<string[]>;
	/** Return every block in the store. Convenience for tests + tooling. */
	getAllBlocks(): Promise<Block[]>;
}
