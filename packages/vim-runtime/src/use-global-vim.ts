import { useEffect } from "react";
import { type LeaderEntry, lookupLeader, partialLeaderMatches } from "./leader";
import { useVimRuntime } from "./store";

export interface GlobalVimDeps {
	openPalette: (mode?: string) => void;
	openCapture: (preset: "journal" | "task" | "note") => void;
	openBlockDetails: () => void;
	openOutline: () => void;
	openViewsSubmode: () => void;
}

const LEADER_TIMEOUT_MS = 300;

export function useGlobalVim(deps: GlobalVimDeps) {
	const enterLeader = useVimRuntime((s) => s.enterLeader);
	const cancelLeader = useVimRuntime((s) => s.cancelLeader);
	const appendChord = useVimRuntime((s) => s.appendChord);
	const popFocus = useVimRuntime((s) => s.popFocus);

	useEffect(() => {
		let timer: ReturnType<typeof setTimeout> | null = null;

		function clearTimer() {
			if (timer) {
				clearTimeout(timer);
				timer = null;
			}
		}

		function handleKey(event: KeyboardEvent) {
			const tgt = event.target as HTMLElement | null;
			const inEditable =
				tgt?.tagName === "INPUT" ||
				tgt?.tagName === "TEXTAREA" ||
				tgt?.isContentEditable === true ||
				Boolean(tgt?.closest?.(".cm-editor"));

			const state = useVimRuntime.getState();

			if (event.key === "Escape") {
				if (state.leaderActive) {
					clearTimer();
					cancelLeader();
					event.preventDefault();
					return;
				}
				const popped = popFocus();
				if (popped) event.preventDefault();
				return;
			}

			if (state.leaderActive) {
				clearTimer();
				const next = [...state.chord, event.key];
				appendChord(event.key);
				const exact = lookupLeader(next);
				if (exact) {
					fireLeader(exact, deps);
					cancelLeader();
					event.preventDefault();
					return;
				}
				const partial = partialLeaderMatches(next);
				if (partial.length === 0) {
					cancelLeader();
				} else {
					timer = setTimeout(() => {
						// popup already showing because store mutation triggers render
					}, LEADER_TIMEOUT_MS);
				}
				event.preventDefault();
				return;
			}

			// not in leader. Trigger leader on Space when not in editable surface.
			if (event.key === " " && !inEditable) {
				enterLeader();
				timer = setTimeout(() => {
					// popup will appear because store has leaderActive=true & chord=[]
				}, LEADER_TIMEOUT_MS);
				event.preventDefault();
				return;
			}
		}

		window.addEventListener("keydown", handleKey, true);
		return () => {
			window.removeEventListener("keydown", handleKey, true);
			clearTimer();
		};
	}, [deps, enterLeader, cancelLeader, appendChord, popFocus]);
}

function fireLeader(entry: LeaderEntry, deps: GlobalVimDeps) {
	switch (entry.action.kind) {
		case "palette":
			return deps.openPalette(entry.action.mode);
		case "capture":
			return deps.openCapture(entry.action.preset);
		case "blockDetails":
			return deps.openBlockDetails();
		case "outline":
			return deps.openOutline();
		case "view":
			return deps.openViewsSubmode();
	}
}
