import type { ParseWarning } from "../parser";

export interface IndexResult {
	filesParsed: number;
	blocksUpserted: number;
	blocksDeleted: number;
	/** Total number of headings the indexer stamped with a fresh `:ID:`. */
	idsMinted: number;
	warnings: ParseWarning[];
}

/**
 * Optional logger. The desktop runtime passes a wrapper around
 * `tauri-plugin-log`; tests pass a silent default.
 */
export interface IndexerLogger {
	info(message: string): void;
	warn(message: string): void;
}

export const SILENT_LOGGER: IndexerLogger = {
	info: () => {},
	warn: () => {},
};
