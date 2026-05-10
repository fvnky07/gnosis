import type { CSSProperties } from "react";
import { useVimRuntime, type VimMode } from "./store";

/* Each mode binds to a pair of CSS vars defined in
 * `packages/ui/src/styles/globals.css` (`--mode-*` + `--mode-*-fg`). The
 * pill renders as a small uppercase capsule sized to match the status
 * bar's 11px text — half-height of the host bar feels native on macOS. */
const MODE_LABELS: Record<VimMode, string> = {
	NORMAL: "NORMAL",
	INSERT: "INSERT",
	VISUAL: "VISUAL",
	REPLACE: "REPLACE",
	COMMAND: "COMMAND",
	LIST: "LIST",
	LEADER: "LEADER",
};

const MODE_TOKEN: Record<VimMode, { bg: string; fg: string }> = {
	NORMAL: { bg: "var(--mode-normal)", fg: "var(--mode-normal-fg)" },
	INSERT: { bg: "var(--mode-insert)", fg: "var(--mode-insert-fg)" },
	VISUAL: { bg: "var(--mode-visual)", fg: "var(--mode-visual-fg)" },
	REPLACE: { bg: "var(--mode-replace)", fg: "var(--mode-replace-fg)" },
	COMMAND: { bg: "var(--mode-command)", fg: "var(--mode-command-fg)" },
	LIST: { bg: "var(--mode-list)", fg: "var(--mode-list-fg)" },
	LEADER: { bg: "var(--mode-leader)", fg: "var(--mode-leader-fg)" },
};

export function ModePill({ className = "" }: { className?: string }) {
	const mode = useVimRuntime((s) => s.mode);
	const leaderActive = useVimRuntime((s) => s.leaderActive);
	const display: VimMode = leaderActive ? "LEADER" : mode;
	const token = MODE_TOKEN[display];
	const style: CSSProperties = {
		backgroundColor: token.bg,
		color: token.fg,
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
