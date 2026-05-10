import { describe, expect, it } from "vitest";
import { INITIAL_STATE, paletteReducer } from "../src/state";

describe("paletteReducer", () => {
	it("starts closed", () => {
		expect(INITIAL_STATE.open).toBe(false);
	});
	it("open resets and opens", () => {
		const dirty = {
			...INITIAL_STATE,
			query: "stale",
			highlight: 5,
			modeStack: ["commands"] as const,
		};
		const next = paletteReducer(dirty as never, { type: "open" });
		expect(next).toMatchObject({
			open: true,
			query: "",
			highlight: 0,
			modeStack: [],
			mode: "root",
		});
	});
	it("close resets and closes", () => {
		const next = paletteReducer(
			{ ...INITIAL_STATE, open: true, query: "x" },
			{ type: "close" },
		);
		expect(next.open).toBe(false);
		expect(next.query).toBe("");
	});
	it("set-query resets highlight", () => {
		const next = paletteReducer(
			{ ...INITIAL_STATE, highlight: 7 },
			{ type: "set-query", query: "abc" },
		);
		expect(next.query).toBe("abc");
		expect(next.highlight).toBe(0);
	});
	it("push-mode tracks the previous mode for Esc to pop later", () => {
		const next = paletteReducer(
			{ ...INITIAL_STATE, mode: "root" },
			{ type: "push-mode", mode: "commands" },
		);
		expect(next.mode).toBe("commands");
		expect(next.modeStack).toEqual(["root"]);
	});
	it("highlight-move wraps both directions", () => {
		const start = { ...INITIAL_STATE, highlight: 0 };
		const down = paletteReducer(start, {
			type: "highlight-move",
			delta: 1,
			total: 3,
		});
		expect(down.highlight).toBe(1);
		const wrapUp = paletteReducer(start, {
			type: "highlight-move",
			delta: -1,
			total: 3,
		});
		expect(wrapUp.highlight).toBe(2);
	});
	it("highlight-edge jumps to first / last", () => {
		const first = paletteReducer(INITIAL_STATE, {
			type: "highlight-edge",
			edge: "first",
			total: 5,
		});
		expect(first.highlight).toBe(0);
		const last = paletteReducer(INITIAL_STATE, {
			type: "highlight-edge",
			edge: "last",
			total: 5,
		});
		expect(last.highlight).toBe(4);
	});
	it("Esc INSERT → LIST", () => {
		const start = { ...INITIAL_STATE, open: true, cursor: "INSERT" as const };
		const next = paletteReducer(start, { type: "escape", total: 3 });
		expect(next.cursor).toBe("LIST");
		expect(next.open).toBe(true);
	});
	it("Esc LIST without sub-mode closes", () => {
		const start = {
			...INITIAL_STATE,
			open: true,
			cursor: "LIST" as const,
			modeStack: [],
		};
		const next = paletteReducer(start, { type: "escape", total: 3 });
		expect(next.open).toBe(false);
	});
	it("Esc LIST with sub-mode pops one level", () => {
		const start = {
			...INITIAL_STATE,
			open: true,
			cursor: "LIST" as const,
			mode: "commands" as const,
			modeStack: ["root" as const],
		};
		const next = paletteReducer(start, { type: "escape", total: 3 });
		expect(next.mode).toBe("root");
		expect(next.modeStack).toEqual([]);
		expect(next.open).toBe(true);
	});
	it("Esc SUB → LIST", () => {
		const start = { ...INITIAL_STATE, open: true, cursor: "SUB" as const };
		const next = paletteReducer(start, { type: "escape", total: 3 });
		expect(next.cursor).toBe("LIST");
	});
});
