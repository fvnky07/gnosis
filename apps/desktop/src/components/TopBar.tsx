import type { SelectionInfo } from "@gnosis/editor";
import { ModePill } from "@gnosis/vim-runtime";
import {
	CalendarRangeIcon,
	type LucideIcon,
	NotebookPenIcon,
	SearchIcon,
} from "lucide-react";

interface TopBarProps {
	/** Vault root absolute path; used to compute the relative file label. */
	vaultPath: string;
	/** Absolute path of the active buffer. Pseudo-paths starting with `(`
	 * (e.g. `(welcome)`) are surfaced as `welcome.org`. */
	activeFilePath: string;
	/** Latest selection info from the editor. Null until the editor first
	 * mounts and emits. */
	selection: SelectionInfo | null;
	/** Click handler for the centered search pill. */
	onOpenPalette(): void;
	/** Click handler for the Agenda / Journal icon buttons. */
	onOpenView(id: "agenda" | "journal"): void;
	className?: string;
}

/**
 * Single horizontal chrome at the top of the shell. Layout:
 *
 *   [traffic-light spacer][filename] · · · [search pill][agenda][journal] · · · [mode][loc][words][chars]
 *
 * The macOS native traffic lights are drawn by the OS (Tauri `titleBarStyle: "Overlay"`),
 * so we just reserve 72px on the left. The bar is 44px tall — taller than the
 * default OS title bar overlay (~28px) so the search pill and status row read
 * as proper toolbar items rather than a thin status strip, while still letting
 * the OS traffic lights sit at their default y-offset (looks centered enough).
 * The center cluster is absolutely positioned so its position does not depend
 * on the variable widths of the side groups. The filename sits left-of-center
 * so the user always knows what they're editing without scanning to the right.
 * The whole bar is a Tauri drag region; interactive children opt out via
 * `no-drag-region`.
 */
export function TopBar({
	vaultPath,
	activeFilePath,
	selection,
	onOpenPalette,
	onOpenView,
	className,
}: TopBarProps) {
	const fileLabel = formatFileLabel(vaultPath, activeFilePath);
	return (
		<div
			role="toolbar"
			aria-label="Top bar"
			className={`drag-region relative flex h-11 shrink-0 items-center px-2 ${className ?? ""}`}
		>
			<div aria-hidden className="w-[72px] shrink-0" />

			<span
				className="no-drag-region max-w-[200px] truncate font-mono text-[11px] text-foreground"
				title={activeFilePath}
			>
				{fileLabel}
			</span>

			<div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-1.5">
				<button
					type="button"
					onClick={onOpenPalette}
					className="no-drag-region inline-flex h-7 w-[clamp(220px,32vw,360px)] items-center gap-2 rounded-lg border border-border bg-muted/40 px-2.5 text-muted-foreground text-xs transition-colors hover:bg-muted/70 hover:text-foreground"
				>
					<SearchIcon className="size-3.5 shrink-0 opacity-70" />
					<span className="flex-1 text-left">Search vault…</span>
					<kbd className="rounded bg-background/60 px-1 font-mono text-[10px] text-muted-foreground/80">
						⌘K
					</kbd>
				</button>
				<IconButton
					onClick={() => onOpenView("agenda")}
					label="Open agenda"
					icon={CalendarRangeIcon}
				/>
				<IconButton
					onClick={() => onOpenView("journal")}
					label="Open journal"
					icon={NotebookPenIcon}
				/>
			</div>

			<nav
				aria-label="Status"
				className="no-drag-region ml-auto inline-flex items-center gap-3 whitespace-nowrap font-mono text-[11px] text-muted-foreground"
			>
				<ModePill monochrome />
				<span>{formatLocation(selection)}</span>
				<span>{formatWords(selection)}</span>
				<span>{formatChars(selection)}</span>
			</nav>
		</div>
	);
}

function IconButton({
	icon: Icon,
	label,
	onClick,
}: {
	icon: LucideIcon;
	label: string;
	onClick(): void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-label={label}
			title={label}
			className="no-drag-region inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
		>
			<Icon className="size-3.5" />
		</button>
	);
}

function formatFileLabel(vaultPath: string, filePath: string): string {
	if (!filePath) return "—";
	if (filePath.startsWith("(") && filePath.endsWith(")")) {
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
