import type { SelectionInfo } from "@gnosis/editor";
import { ModePill } from "@gnosis/vim-runtime";

interface StatusBarProps {
	/** Vault root absolute path; used to compute the relative file label. */
	vaultPath: string;
	/** Absolute path of the active buffer. Pseudo-paths starting with `(`
	 * (e.g. `(welcome)`) are surfaced as-is without folder stripping. */
	activeFilePath: string;
	/** Latest selection info from the editor. Null until the editor first
	 * mounts and emits. */
	selection: SelectionInfo | null;
	className?: string;
}

/**
 * Floating macOS-style pill at the bottom of the shell. Contents are
 * centered when they fit; once they exceed the bar width the inner row
 * scrolls horizontally (no visible scrollbar) per the user's
 * "horizontal scroll inside the bar" overflow preference.
 *
 * Items: mode pill · folder/title.ext · L:C · N words. The dot separator
 * is a static span so it travels inside the scrollable inner row.
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
			className={`no-drag-region scrollbar-none inline-flex h-7 max-w-full items-center overflow-x-auto rounded-full border border-border bg-card px-3 font-mono text-[11px] text-muted-foreground shadow-sm ${className ?? ""}`}
		>
			<div className="flex items-center gap-3 whitespace-nowrap">
				<ModePill />
				<span className="text-foreground" title={activeFilePath}>
					{fileLabel}
				</span>
				<Separator />
				<span>{formatLocation(selection)}</span>
				<Separator />
				<span>{formatWords(selection)}</span>
			</div>
		</nav>
	);
}

function Separator() {
	return <span className="text-muted-foreground/40">·</span>;
}

function formatFileLabel(vaultPath: string, filePath: string): string {
	if (!filePath) return "—";
	if (filePath.startsWith("(") && filePath.endsWith(")")) {
		// Pseudo-buffer like "(welcome)" — show the label verbatim, no
		// folder prefix logic.
		return filePath.slice(1, -1);
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
