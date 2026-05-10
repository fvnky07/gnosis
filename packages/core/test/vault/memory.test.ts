import { describe, expect, it } from "vitest";
import { MemoryVault } from "../../src/vault/memory";

describe("MemoryVault", () => {
	it("lists only .org files", async () => {
		const vault = new MemoryVault();
		vault.setFile("a.org", "* a");
		vault.setFile("b.txt", "ignored");
		vault.setFile("nested/c.org", "* c");

		const files = await vault.list();
		expect(files.map((f) => f.path).sort()).toEqual(["a.org", "nested/c.org"]);
	});

	it("excludes hidden files and .git/", async () => {
		const vault = new MemoryVault();
		vault.setFile("visible.org", "* v");
		vault.setFile(".hidden.org", "* h");
		vault.setFile(".git/HEAD.org", "* git");
		vault.setFile("ok/.dotdir/skip.org", "* skip");

		const files = await vault.list();
		expect(files.map((f) => f.path)).toEqual(["visible.org"]);
	});

	it("read returns the stored content", async () => {
		const vault = new MemoryVault();
		vault.setFile("x.org", "hello");
		expect(await vault.read("x.org")).toBe("hello");
	});

	it("read throws on missing file", async () => {
		const vault = new MemoryVault();
		await expect(vault.read("nope.org")).rejects.toThrow(/not found/);
	});

	it("write replaces content and updates mtime", async () => {
		const vault = new MemoryVault();
		vault.setFile("x.org", "old", 1000);
		await vault.write("x.org", "new");
		expect(await vault.read("x.org")).toBe("new");
		const [meta] = await vault.list();
		expect(meta.mtimeMs).toBeGreaterThan(1000);
	});

	it("ensureDir is a no-op", async () => {
		const vault = new MemoryVault();
		await expect(vault.ensureDir("some/dir")).resolves.toBeUndefined();
	});

	it("list returns paths sorted", async () => {
		const vault = new MemoryVault();
		vault.setFile("z.org", "");
		vault.setFile("a.org", "");
		vault.setFile("m.org", "");
		const files = await vault.list();
		expect(files.map((f) => f.path)).toEqual(["a.org", "m.org", "z.org"]);
	});
});
