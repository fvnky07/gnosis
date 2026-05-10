import { describe, expect, it } from "vitest";
import { parseFileKeywords } from "../../src/parser/file-keywords";

describe("parseFileKeywords", () => {
	it("returns empty for empty preamble", () => {
		expect(parseFileKeywords("")).toEqual({ fileTags: [] });
	});

	it("parses #+TITLE", () => {
		const result = parseFileKeywords("#+TITLE: My Vault\n\n");
		expect(result.title).toBe("My Vault");
	});

	it("parses #+FILETAGS in colon form", () => {
		const result = parseFileKeywords("#+FILETAGS: :work:personal:\n");
		expect(result.fileTags).toEqual(["work", "personal"]);
	});

	it("parses #+FILETAGS in space form", () => {
		const result = parseFileKeywords("#+FILETAGS: work personal\n");
		expect(result.fileTags).toEqual(["work", "personal"]);
	});

	it("ignores other #+... keywords", () => {
		const result = parseFileKeywords("#+OPTIONS: toc:nil\n#+TITLE: T\n");
		expect(result.title).toBe("T");
		expect(result.fileTags).toEqual([]);
	});

	it("is case-insensitive on keyword name", () => {
		const result = parseFileKeywords("#+title: lower\n#+filetags: :a:\n");
		expect(result.title).toBe("lower");
		expect(result.fileTags).toEqual(["a"]);
	});

	it("only first #+TITLE wins", () => {
		const result = parseFileKeywords("#+TITLE: First\n#+TITLE: Second\n");
		expect(result.title).toBe("First");
	});
});
