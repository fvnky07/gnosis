import type { SelectionInfo } from "@gnosis/editor";
import { ModePill } from "@gnosis/vim-runtime";
import { useEffect, useState } from "react";
import { useSettings } from "../lib/settings-store";

interface StatusBarProps {
	/** Vault root absolute path; used to compute the relative file label. */
	vaultPath: string;
	/** Absolute path of the active buffer. Pseudo-paths starting with `(`
	 * (e.g. `(welcome)`) are surfaced as `welcome.org` so the row reads as
	 * a real org file in the user's eyes. */
	activeFilePath: string;
	/** Latest selection info from the editor. Null until the editor first
	 * mounts and emits. */
	selection: SelectionInfo | null;
	className?: string;
}

const READING_WPM = 250;

/**
 * Inline status row at the bottom of the shell. Sits on the canvas
 * background (no card surface, no border, no dot separators) so it
 * reads like an ambient indicator strip rather than a chip. Items are
 * whitespace-separated and the row scrolls horizontally if it overflows
 * the available width.
 *
 * Each slot is gated by `settings.interface.statusBar.show*` — users can
 * pick which indicators show up. A parallel PR refactors this row into a
 * top bar, so the position is intentionally fixed-bottom for now.
 *
 * Order (when enabled): mode pill · register · folder/title.ext · L:C ·
 * words · chars · reading-time · clock.
 */
export function StatusBar({
	vaultPath,
	activeFilePath,
	selection,
	className,
}: StatusBarProps) {
	const sb = useSettings((s) => s.interface.statusBar);
	const fileLabel = formatFileLabel(vaultPath, activeFilePath);
	const clock = useClock(sb.showClock);
	return (
		<nav
			aria-label="Status"
			className={`no-drag-region scrollbar-none inline-flex max-w-full items-center gap-4 overflow-x-auto whitespace-nowrap font-mono text-[11px] text-muted-foreground ${className ?? ""}`}
		>
			{sb.showMode ? <ModePill /> : null}
			{sb.showVimRegister ? <span>"{readRegister() || "_"}</span> : null}
			{sb.showFilePath ? (
				<span className="text-foreground" title={activeFilePath}>
					{fileLabel}
				</span>
			) : null}
			{sb.showLineCol ? <span>{formatLocation(selection)}</span> : null}
			{sb.showWordCount ? <span>{formatWords(selection)}</span> : null}
			{sb.showCharCount ? <span>{formatChars(selection)}</span> : null}
			{sb.showReadingTime ? <span>{formatReadingTime(selection)}</span> : null}
			{sb.showClock ? <span>{clock}</span> : null}
		</nav>
	);
}

function readRegister(): string {
	// The vim register slot is a placeholder for the rebind/clipboard PR.
	// Until cm-vim exposes the active register, display `"` to mark the slot.
	return "";
}

function useClock(enabled: boolean): string {
	const [time, setTime] = useState(() => formatClock(new Date()));
	useEffect(() => {
		if (!enabled) return;
		const tick = () => setTime(formatClock(new Date()));
		tick();
		const id = window.setInterval(tick, 30 * 1000);
		return () => window.clearInterval(id);
	}, [enabled]);
	return time;
}

function formatClock(d: Date): string {
	const hh = d.getHours().toString().padStart(2, "0");
	const mm = d.getMinutes().toString().padStart(2, "0");
	return `${hh}:${mm}`;
}

function formatFileLabel(vaultPath: string, filePath: string): string {
	if (!filePath) return "—";
	if (filePath.startsWith("(") && filePath.endsWith(")")) {
		// Pseudo-buffer like "(welcome)" — surface as `welcome.org` so the
		// status row never shows a bare label without an extension.
		return `${filePath.slice(1, -1)}.org`;
	}
	const rel = relativeTo(vaultPath, filePath);
	const segments = rel.split("/").filter(Boolean);
	if (segments.length <= 1) return segments[0] ?? rel;
	const file = segments[segments.length - 1];
	const folder = segments[segments.length - 2];
	return `${folder}/${file}`;
}

function relativeTo(root: string, abs: string): string {
	if (!root) return abs;
	if (abs.startsWith(`${root}/`)) return abs.slice(root.length + 1);
	if (abs === root) return "";
	return abs;
}

function formatLocation(selection: SelectionInfo | null): string {
	if (!selection) return "1:1";
	return `${selection.line}:${selection.col}`;
}

function formatWords(selection: SelectionInfo | null): string {
	if (!selection) return "0 words";
	const total = selection.totalWords.toLocaleString();
	if (selection.selectedWords > 0) {
		const sel = selection.selectedWords.toLocaleString();
		return `${sel}/${total} words`;
	}
	return `${total} words`;
}

function formatChars(selection: SelectionInfo | null): string {
	if (!selection) return "0 chars";
	const total = selection.totalChars.toLocaleString();
	if (selection.selectedChars > 0) {
		const sel = selection.selectedChars.toLocaleString();
		return `${sel}/${total} chars`;
	}
	return `${total} chars`;
}

function formatReadingTime(selection: SelectionInfo | null): string {
	const words = selection?.totalWords ?? 0;
	if (words === 0) return "0 min";
	const minutes = Math.max(1, Math.round(words / READING_WPM));
	return `${minutes} min read`;
}
