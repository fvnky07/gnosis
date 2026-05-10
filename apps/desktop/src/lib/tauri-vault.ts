/**
 * `Vault` adapter for the Tauri desktop runtime. Wraps `tauri-plugin-fs`
 * with the path-relative-to-root contract `@gnosis/core` expects (forward
 * slashes, no leading `/`).
 *
 * Hidden segments (`.git`, anything starting with `.`) are excluded from
 * `list()` per `planning/04-vault-and-indexer.md`. mtime/size are reported
 * as 0 — the indexer currently re-reads on every pass and doesn't
 * shortcut on freshness, so we save the per-file `stat()` round trip.
 */

import type { FileMeta, Vault } from "@gnosis/core";
import { VaultNotFoundError } from "@gnosis/core";
import {
	exists,
	mkdir,
	readDir,
	readTextFile,
	writeTextFile,
} from "@tauri-apps/plugin-fs";

function joinPath(root: string, rel: string): string {
	const trimmed = rel.replace(/^[/\\]+/, "");
	if (trimmed.length === 0) return root;
	if (root.endsWith("/") || root.endsWith("\\")) return `${root}${trimmed}`;
	return `${root}/${trimmed}`;
}

function isHidden(name: string): boolean {
	return name.startsWith(".");
}

export class TauriVault implements Vault {
	constructor(public readonly rootPath: string) {}

	async list(): Promise<FileMeta[]> {
		const out: FileMeta[] = [];
		await walk(this.rootPath, "", out);
		out.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
		return out;
	}

	async read(path: string): Promise<string> {
		const abs = joinPath(this.rootPath, path);
		if (!(await exists(abs))) {
			throw new VaultNotFoundError(path);
		}
		return await readTextFile(abs);
	}

	async write(path: string, content: string): Promise<void> {
		const slash = path.lastIndexOf("/");
		if (slash > 0) await this.ensureDir(path.slice(0, slash));
		await writeTextFile(joinPath(this.rootPath, path), content);
	}

	async ensureDir(path: string): Promise<void> {
		const abs = joinPath(this.rootPath, path);
		if (await exists(abs)) return;
		await mkdir(abs, { recursive: true });
	}
}

async function walk(root: string, rel: string, out: FileMeta[]): Promise<void> {
	const dir = rel ? joinPath(root, rel) : root;
	const entries = await readDir(dir);
	for (const entry of entries) {
		if (isHidden(entry.name)) continue;
		const childRel = rel ? `${rel}/${entry.name}` : entry.name;
		if (entry.isDirectory) {
			await walk(root, childRel, out);
		} else if (entry.isFile && entry.name.endsWith(".org")) {
			out.push({ path: childRel, mtimeMs: 0, size: 0 });
		}
	}
}
