import type { SelectionInfo } from "@gnosis/editor";
import { ModePill } from "@gnosis/vim-runtime";

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

/**
 * Inline status row at the bottom of the shell. Sits on the canvas
 * background (no card surface, no border, no dot separators) so it
 * reads like an ambient indicator strip rather than a chip. Items are
 * whitespace-separated and the row scrolls horizontally if it overflows
 * the available width.
 *
 * Order: mode pill · folder/title.ext · L:C · words · chars
 */
export function StatusBar({
	vaultPath,
	activeFilePath,
	selection,
	className,
}: StatusBarProps) {
	const fileLabel = formatFileLabel(vaultPath, activeFilePath);
	return (
		<nav
			aria-label="Status"
			className={`no-drag-region scrollbar-none inline-flex max-w-full items-center gap-4 overflow-x-auto whitespace-nowrap font-mono text-[11px] text-muted-foreground ${className ?? ""}`}
		>
			<ModePill />
			<span className="text-foreground" title={activeFilePath}>
				{fileLabel}
			</span>
			<span>{formatLocation(selection)}</span>
			<span>{formatWords(selection)}</span>
			<span>{formatChars(selection)}</span>
		</nav>
	);
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
