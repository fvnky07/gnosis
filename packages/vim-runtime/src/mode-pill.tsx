import type { CSSProperties } from "react";
import { useVimRuntime, type VimMode } from "./store";

/* Each mode binds to a `--mode-*` CSS color var defined in
 * `packages/ui/src/styles/globals.css`. The pill uses a translucent
 * tint of that color for the background and the saturated color for
 * the text, matching how Apple's HIG renders status chips (Reminders
 * tags, Music status row, Mail flags) instead of a high-saturation
 * filled capsule. */
const MODE_LABELS: Record<VimMode, string> = {
	NORMAL: "NORMAL",
	INSERT: "INSERT",
	VISUAL: "VISUAL",
	REPLACE: "REPLACE",
	COMMAND: "COMMAND",
	LIST: "LIST",
	LEADER: "LEADER",
};

const MODE_COLOR: Record<VimMode, string> = {
	NORMAL: "var(--mode-normal)",
	INSERT: "var(--mode-insert)",
	VISUAL: "var(--mode-visual)",
	REPLACE: "var(--mode-replace)",
	COMMAND: "var(--mode-command)",
	LIST: "var(--mode-list)",
	LEADER: "var(--mode-leader)",
};

export function ModePill({ className = "" }: { className?: string }) {
	const mode = useVimRuntime((s) => s.mode);
	const leaderActive = useVimRuntime((s) => s.leaderActive);
	const display: VimMode = leaderActive ? "LEADER" : mode;
	const color = MODE_COLOR[display];
	const style: CSSProperties = {
		backgroundColor: `color-mix(in oklab, ${color} 18%, transparent)`,
		color,
		boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${color} 28%, transparent)`,
	};
	return (
		<span
			style={style}
			className={`inline-flex h-[18px] select-none items-center rounded-full px-2 font-mono text-[10px] uppercase leading-none tracking-wider ${className}`}
		>
			{MODE_LABELS[display]}
		</span>
	);
}
