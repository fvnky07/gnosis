import { describe, expect, it } from "vitest";
import { LEADER_MAP, lookupLeader, partialLeaderMatches } from "../src/leader";

describe("lookupLeader", () => {
	it("returns palette entry for Space chord", () => {
		const entry = lookupLeader([" "]);
		expect(entry).toBeDefined();
		expect(entry?.action.kind).toBe("palette");
	});

	it("returns journal capture entry for j chord", () => {
		const entry = lookupLeader(["j"]);
		expect(entry).toBeDefined();
		expect(entry?.action.kind).toBe("capture");
		if (entry?.action.kind === "capture") {
			expect(entry.action.preset).toBe("journal");
		}
	});

	it("returns undefined for unknown chord", () => {
		expect(lookupLeader(["x"])).toBeUndefined();
		expect(lookupLeader(["a", "b"])).toBeUndefined();
	});
});

describe("partialLeaderMatches", () => {
	it("returns full LEADER_MAP for empty chord", () => {
		const matches = partialLeaderMatches([]);
		expect(matches).toHaveLength(LEADER_MAP.length);
		expect(matches).toEqual(LEADER_MAP);
	});

	it("returns empty array for unknown prefix", () => {
		const matches = partialLeaderMatches(["x"]);
		expect(matches).toHaveLength(0);
	});

	it("returns matching entries for known prefix", () => {
		const matches = partialLeaderMatches(["j"]);
		expect(matches).toHaveLength(1);
		expect(matches[0]?.action.kind).toBe("capture");
	});
});
