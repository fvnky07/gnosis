import { beforeEach, describe, expect, it } from "vitest";
import { useVimRuntime } from "../src/store";

beforeEach(() => {
	// Reset store state before each test
	useVimRuntime.setState({
		mode: "INSERT",
		chord: [],
		focusStack: [{ kind: "editor" }],
		leaderActive: false,
		leaderStartedAt: null,
	});
});

describe("focusStack", () => {
	it("pushes a layer onto the focus stack", () => {
		const { pushFocus } = useVimRuntime.getState();
		pushFocus({ kind: "palette" });
		expect(useVimRuntime.getState().focusStack).toEqual([
			{ kind: "editor" },
			{ kind: "palette" },
		]);
	});

	it("pops the top layer from the focus stack", () => {
		const { pushFocus, popFocus } = useVimRuntime.getState();
		pushFocus({ kind: "palette" });
		const popped = popFocus();
		expect(popped).toEqual({ kind: "palette" });
		expect(useVimRuntime.getState().focusStack).toEqual([{ kind: "editor" }]);
	});

	it("returns undefined when popping the last layer", () => {
		const { popFocus } = useVimRuntime.getState();
		const popped = popFocus();
		expect(popped).toBeUndefined();
		expect(useVimRuntime.getState().focusStack).toHaveLength(1);
	});
});

describe("leader", () => {
	it("enterLeader sets leaderActive and resets chord", () => {
		const { enterLeader } = useVimRuntime.getState();
		enterLeader();
		const state = useVimRuntime.getState();
		expect(state.leaderActive).toBe(true);
		expect(state.chord).toEqual([]);
		expect(state.leaderStartedAt).toBeTypeOf("number");
	});

	it("cancelLeader clears leader state", () => {
		const { enterLeader, cancelLeader } = useVimRuntime.getState();
		enterLeader();
		cancelLeader();
		const state = useVimRuntime.getState();
		expect(state.leaderActive).toBe(false);
		expect(state.leaderStartedAt).toBeNull();
		expect(state.chord).toEqual([]);
	});

	it("appendChord accumulates keys", () => {
		const { appendChord } = useVimRuntime.getState();
		appendChord("f");
		appendChord("o");
		expect(useVimRuntime.getState().chord).toEqual(["f", "o"]);
	});
});

describe("setMode", () => {
	it("updates the vim mode", () => {
		const { setMode } = useVimRuntime.getState();
		setMode("NORMAL");
		expect(useVimRuntime.getState().mode).toBe("NORMAL");
		setMode("VISUAL");
		expect(useVimRuntime.getState().mode).toBe("VISUAL");
	});
});
