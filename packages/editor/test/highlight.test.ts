import { describe, expect, it } from "vitest";
import { findOrgTokens, ORG_TOKEN_CLASS } from "../src/highlight";

describe("findOrgTokens", () => {
	it("returns empty for plain text", () => {
		expect(findOrgTokens("hello world\nno org markup")).toEqual([]);
	});

	it("locates a TODO keyword", () => {
		const text = "* TODO buy milk";
		const tokens = findOrgTokens(text);
		expect(tokens).toEqual([{ kind: "todo-keyword", start: 2, end: 6 }]);
	});

	it("locates DONE keyword", () => {
		const text = "** DONE write parser";
		const tokens = findOrgTokens(text);
		expect(tokens.find((t) => t.kind === "todo-keyword")).toMatchObject({
			start: 3,
			end: 7,
		});
	});

	it("locates priority cookies", () => {
		const text = "* TODO [#A] critical";
		const tokens = findOrgTokens(text);
		const priority = tokens.find((t) => t.kind === "priority");
		expect(priority).toEqual({ kind: "priority", start: 7, end: 11 });
	});

	it("locates trailing tags on heading lines", () => {
		const text = "* heading text :work:project:";
		const tokens = findOrgTokens(text);
		const tag = tokens.find((t) => t.kind === "tag");
		expect(tag).toBeDefined();
		expect(text.slice(tag?.start ?? 0, tag?.end ?? 0)).toBe(":work:project:");
	});

	it("does not treat mid-line :foo: as a tag", () => {
		expect(
			findOrgTokens("body line with :embedded:references").filter(
				(t) => t.kind === "tag",
			),
		).toEqual([]);
	});

	it("locates active and inactive timestamps", () => {
		const text =
			"SCHEDULED: <2026-05-07 Thu 09:00> CLOSED: [2026-05-06 Wed 12:00]";
		const tokens = findOrgTokens(text);
		const active = tokens.find((t) => t.kind === "timestamp-active");
		const inactive = tokens.find((t) => t.kind === "timestamp-inactive");
		expect(text.slice(active?.start ?? 0, active?.end ?? 0)).toBe(
			"<2026-05-07 Thu 09:00>",
		);
		expect(text.slice(inactive?.start ?? 0, inactive?.end ?? 0)).toBe(
			"[2026-05-06 Wed 12:00]",
		);
	});

	it("locates :PROPERTIES: and :END: drawer markers", () => {
		const text = ":PROPERTIES:\n:ID: 01J9\n:END:";
		const tokens = findOrgTokens(text);
		const drawerTokens = tokens.filter((t) => t.kind === "drawer-marker");
		expect(drawerTokens).toHaveLength(2);
		expect(text.slice(drawerTokens[0].start, drawerTokens[0].end)).toBe(
			":PROPERTIES:",
		);
		expect(text.slice(drawerTokens[1].start, drawerTokens[1].end)).toBe(
			":END:",
		);
	});

	it("locates #+TITLE and other file keywords", () => {
		const text = "#+TITLE: My Vault\n#+FILETAGS: :a:";
		const tokens = findOrgTokens(text);
		const fileTokens = tokens.filter((t) => t.kind === "file-keyword");
		expect(fileTokens).toHaveLength(2);
	});

	it("returns tokens sorted by start offset", () => {
		const text =
			"#+TITLE: Doc\n* TODO [#A] task :work:\n:PROPERTIES:\n:ID: 01J9\n:END:\nSCHEDULED: <2026-05-07 Thu>\nbody";
		const tokens = findOrgTokens(text);
		for (let i = 1; i < tokens.length; i++) {
			expect(tokens[i].start).toBeGreaterThanOrEqual(tokens[i - 1].start);
		}
	});

	it("class map covers every kind", () => {
		const kinds = [
			"todo-keyword",
			"priority",
			"tag",
			"timestamp-active",
			"timestamp-inactive",
			"drawer-marker",
			"file-keyword",
		] as const;
		for (const kind of kinds) {
			expect(ORG_TOKEN_CLASS[kind]).toMatch(/^cm-gnosis-/);
		}
	});
});
