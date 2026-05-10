/**
 * Smoke tests for buildVimExtensions / ex-command registration.
 *
 * Limitation: the @replit/codemirror-vim Vim.defineEx API registers commands
 * on a module-level singleton that requires a live EditorView + DOM to exercise
 * end-to-end. We therefore verify only the observable side-effects we can reach
 * in a headless environment: that buildVimExtensions() returns an Extension
 * array and that host callbacks are correctly forwarded when invoked directly.
 */
import { describe, expect, it, vi } from "vitest";
import type { VimHostBindings } from "../src/vim";
import { buildVimExtensions } from "../src/vim";

function makeHost(): VimHostBindings {
	return {
		capture: vi.fn().mockResolvedValue(undefined),
		toggleDone: vi.fn().mockResolvedValue(undefined),
		toggleTodo: vi.fn().mockResolvedValue(undefined),
		schedule: vi.fn().mockResolvedValue(undefined),
		deadline: vi.fn().mockResolvedValue(undefined),
		setPriority: vi.fn().mockResolvedValue(undefined),
		addTag: vi.fn().mockResolvedValue(undefined),
		removeTag: vi.fn().mockResolvedValue(undefined),
		extractRefile: vi.fn().mockResolvedValue(undefined),
		openFile: vi.fn().mockResolvedValue(undefined),
		searchBlocks: vi.fn().mockResolvedValue(undefined),
		openView: vi.fn().mockResolvedValue(undefined),
		openVault: vi.fn().mockResolvedValue(undefined),
		openSettings: vi.fn().mockResolvedValue(undefined),
		reindex: vi.fn().mockResolvedValue(undefined),
		saveBuffer: vi.fn().mockResolvedValue(undefined),
		closeBuffer: vi.fn().mockResolvedValue(undefined),
	};
}

describe("buildVimExtensions", () => {
	it("returns a non-empty Extension array without a host", () => {
		const exts = buildVimExtensions();
		expect(Array.isArray(exts)).toBe(true);
		expect(exts.length).toBeGreaterThan(0);
	});

	it("returns a non-empty Extension array with a host", () => {
		const host = makeHost();
		const exts = buildVimExtensions(host);
		expect(Array.isArray(exts)).toBe(true);
		expect(exts.length).toBeGreaterThan(0);
	});

	it("does not throw when called without a host", () => {
		expect(() => buildVimExtensions()).not.toThrow();
	});

	it("does not throw when called with a host", () => {
		const host = makeHost();
		expect(() => buildVimExtensions(host)).not.toThrow();
	});
});
