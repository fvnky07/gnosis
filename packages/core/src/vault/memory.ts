import type { FileMeta, Vault } from "./types";
import { VaultNotFoundError } from "./types";

interface MemoryFile {
	content: string;
	mtimeMs: number;
	size: number;
}

/**
 * In-memory {@link Vault} implementation. Used by tests for the indexer and
 * any other node-side code that wants a fast, deterministic vault without
 * touching the filesystem.
 *
 * Test helpers ({@link MemoryVault.setFile}, {@link MemoryVault.deleteFile},
 * {@link MemoryVault.snapshot}) live alongside the {@link Vault} interface.
 */
export class MemoryVault implements Vault {
	rootPath: string;
	private files = new Map<string, MemoryFile>();

	constructor(rootPath = "/memory") {
		this.rootPath = rootPath;
	}

	async list(): Promise<FileMeta[]> {
		const out: FileMeta[] = [];
		for (const [path, meta] of this.files) {
			if (!path.endsWith(".org")) continue;
			if (isHiddenPath(path)) continue;
			out.push({ path, mtimeMs: meta.mtimeMs, size: meta.size });
		}
		out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
		return out;
	}

	async read(path: string): Promise<string> {
		const file = this.files.get(path);
		if (!file) {
			throw new VaultNotFoundError(path);
		}
		return file.content;
	}

	async write(path: string, content: string): Promise<void> {
		this.files.set(path, {
			content,
			mtimeMs: Date.now(),
			size: byteLength(content),
		});
	}

	async ensureDir(_path: string): Promise<void> {
		// No-op: MemoryVault has no concept of directories.
	}

	/** Test helper: set a file with an explicit mtime. */
	setFile(path: string, content: string, mtimeMs?: number): void {
		this.files.set(path, {
			content,
			mtimeMs: mtimeMs ?? Date.now(),
			size: byteLength(content),
		});
	}

	/** Test helper: remove a file from the vault. */
	deleteFile(path: string): boolean {
		return this.files.delete(path);
	}

	/** Test helper: snapshot all files for assertion convenience. */
	snapshot(): Record<string, string> {
		const result: Record<string, string> = {};
		for (const [path, meta] of this.files) {
			result[path] = meta.content;
		}
		return result;
	}
}

function isHiddenPath(path: string): boolean {
	return path.split("/").some((segment) => segment.startsWith("."));
}

function byteLength(s: string): number {
	// MemoryVault uses character length as a proxy. The real `TauriVault`
	// reports OS-reported byte size; tests don't depend on the exact value.
	return s.length;
}
