/**
 * The vault contract per `planning/04-vault-and-indexer.md`. Two
 * implementations exist:
 *
 * - {@link MemoryVault} — used by node-side tests.
 * - `TauriVault` — lives in `apps/desktop`, wraps `tauri-plugin-fs`.
 *
 * Paths are relative to {@link Vault.rootPath} and use forward slashes
 * regardless of host OS — adapters normalize at the IO boundary.
 */
export interface FileMeta {
	/** Path relative to the vault root, forward-slash form. */
	path: string;
	/** Last-modified time in milliseconds since epoch. */
	mtimeMs: number;
	/** Byte size of the file. */
	size: number;
}

export interface Vault {
	/** Absolute path to the vault root, suitable for display. */
	rootPath: string;
	/**
	 * List every `.org` file in the vault recursively. Hidden files (segments
	 * starting with `.`) and `.git/` subtrees are excluded. Symlinks are not
	 * followed in MVP.
	 */
	list(): Promise<FileMeta[]>;
	/** Read a file's UTF-8 contents. */
	read(path: string): Promise<string>;
	/** Write a file, creating any missing parent directories. */
	write(path: string, content: string): Promise<void>;
	/** Ensure a directory exists. No-op if already present. */
	ensureDir(path: string): Promise<void>;
}
