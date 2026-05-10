import { describe, expect, it } from "vitest";
import {
	bumpFrecency,
	decay,
	frecencyScore,
	sortByFrecency,
} from "../src/frecency";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("decay", () => {
	it("returns 1 at zero age", () => {
		expect(decay(0)).toBe(1);
	});
	it("monotonically decreases with age", () => {
		expect(decay(DAY_MS)).toBeGreaterThan(decay(7 * DAY_MS));
		expect(decay(7 * DAY_MS)).toBeGreaterThan(decay(30 * DAY_MS));
	});
	it("hits 0.5 at the half-life", () => {
		expect(decay(7 * DAY_MS, 7 * DAY_MS)).toBeCloseTo(0.5, 5);
	});
});

describe("frecencyScore", () => {
	it("returns count at zero age", () => {
		const now = 1_000_000;
		const entry = { count: 5, lastVisitedMs: now };
		expect(frecencyScore(entry, { now: () => now })).toBeCloseTo(5, 5);
	});
	it("weights count by decay", () => {
		const now = 1_000_000;
		const entry = { count: 10, lastVisitedMs: now - 7 * DAY_MS };
		// at half-life: 10 * 0.5 = 5
		expect(frecencyScore(entry, { now: () => now })).toBeCloseTo(5, 5);
	});
});

describe("bumpFrecency", () => {
	it("creates a new entry at count 1", () => {
		const now = 1_000_000;
		const next = bumpFrecency({}, "x", { now: () => now });
		expect(next.x).toEqual({ count: 1, lastVisitedMs: now });
	});
	it("increments count and updates lastVisitedMs", () => {
		const now = 1_000_000;
		const map = { x: { count: 3, lastVisitedMs: now - 2 * DAY_MS } };
		const next = bumpFrecency(map, "x", { now: () => now });
		expect(next.x).toEqual({ count: 4, lastVisitedMs: now });
	});
	it("does not mutate the input map", () => {
		const map = { x: { count: 1, lastVisitedMs: 0 } };
		bumpFrecency(map, "x");
		expect(map.x.count).toBe(1);
	});
});

describe("sortByFrecency", () => {
	it("orders items by score descending", () => {
		const now = 1_000_000;
		const map = {
			high: { count: 10, lastVisitedMs: now },
			low: { count: 1, lastVisitedMs: now - 30 * DAY_MS },
			mid: { count: 3, lastVisitedMs: now - 7 * DAY_MS },
		};
		const items = [{ id: "low" }, { id: "high" }, { id: "mid" }];
		const out = sortByFrecency(items, map, { now: () => now });
		expect(out.map((i) => i.id)).toEqual(["high", "mid", "low"]);
	});
	it("places items missing from the map after items with any history", () => {
		const map = { x: { count: 1, lastVisitedMs: 0 } };
		const items = [{ id: "no-history" }, { id: "x" }];
		const out = sortByFrecency(items, map);
		expect(out.map((i) => i.id)).toEqual(["x", "no-history"]);
	});
});
