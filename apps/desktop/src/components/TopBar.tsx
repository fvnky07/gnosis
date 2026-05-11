import type { SelectionInfo } from "@gnosis/editor";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@gnosis/ui/components/breadcrumb";
import { ModePill } from "@gnosis/vim-runtime";
import {
	CalendarRangeIcon,
	FileIcon,
	FileTextIcon,
	FolderIcon,
	type LucideIcon,
	NotebookPenIcon,
	SearchIcon,
	Sparkles,
} from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { useSettings } from "../lib/settings-store";

interface TopBarProps {
	/** Vault root absolute path; used to compute the relative file label. */
	vaultPath: string;
	/** Absolute path of the active buffer. Pseudo-paths starting with `(`
	 * (e.g. `(welcome)`) are surfaced as `welcome.org`. */
	activeFilePath: string;
	/** Latest selection info from the editor. Null until the editor first
	 * mounts and emits. */
	selection: SelectionInfo | null;
	/** Number of open buffers; rendered at the far right of the status. */
	tabCount: number;
	/** Click handler for the centered search pill. */
	onOpenPalette(): void;
	/** Click handler for the Agenda / Journal icon buttons. */
	onOpenView(id: "agenda" | "journal"): void;
	className?: string;
}

const READING_WPM = 250;

/**
 * Single horizontal chrome at the top of the shell. Layout:
 *
 *   [traffic-light spacer][filename] · · · [search pill][agenda][journal] · · · [mode][loc][words][chars]
 *
 * The macOS native traffic lights are drawn by the OS (Tauri `titleBarStyle: "Overlay"`),
 * so we just reserve 72px on the left. The bar is sized to align its content
 * row with the OS traffic-light center: 30px tall with `pb-[2px]` inset, so
 * `items-center` centers content in a 28px box starting at window y=0. The
 * macOS overlay puts traffic-light centers at y≈14 — a 28px-tall pill
 * (`h-7`) centered in this box has its center at y=14, matching exactly. A
 * 2px strip at the bar's bottom provides breathing room before the editor
 * card. The center cluster is absolutely positioned so its placement does
 * not depend on the variable widths of the side groups. The whole bar is a
 * Tauri drag region; interactive children opt out via `no-drag-region`.
 *
 * Every slot (file path, mode pill, line:col, words, chars, reading time,
 * vim register, clock) is gated by an `interface.topBar.show*` setting so
 * users pick which indicators show up.
 */
export function TopBar({
	vaultPath,
	activeFilePath,
	selection,
	tabCount,
	onOpenPalette,
	onOpenView,
	className,
}: TopBarProps) {
	const tb = useSettings((s) => s.interface.topBar);
	const clock = useClock(tb.showClock);
	return (
		<div
			role="toolbar"
			aria-label="Top bar"
			className={`drag-region relative flex h-10 shrink-0 items-center px-4 pb-0 ${className ?? ""}`}
		>
			<div aria-hidden className="w-[72px] shrink-0" />

			{tb.showFilePath ? (
				<FilePathBreadcrumb
					vaultPath={vaultPath}
					activeFilePath={activeFilePath}
				/>
			) : null}

			<div className="absolute left-1/2 flex -translate-x-1/2 items-center gap-1.5">
				<IconButton
					onClick={() => onOpenView("agenda")}
					label="Open AI chat"
					icon={Sparkles}
				/>
				<button
					type="button"
					onClick={onOpenPalette}
					className="no-drag-region inline-flex h-7 w-[clamp(220px,32vw,360px)] items-center gap-2 rounded-md border border-border bg-muted/40 px-2.5 text-muted-foreground text-sm transition-colors hover:bg-muted/70 hover:text-foreground"
				>
					<SearchIcon className="size-3.5 shrink-0 opacity-70" />
					<span className="flex-1 text-left">Search vault…</span>
					<kbd className="rounded bg-background px-1.5 font-mono text-muted-foreground text-sm">
						⌘k
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
				className="no-drag-region ml-auto inline-flex items-center gap-3 whitespace-nowrap text-muted-foreground text-xs tabular-nums"
			>
				{tb.showMode ? <ModePill monochrome /> : null}
				{tb.showVimRegister ? <span>"{readRegister() || "_"}</span> : null}
				{tb.showLineCol ? <span>{formatLocation(selection)}</span> : null}
				{tb.showWordCount || tb.showCharCount ? (
					<span>
						{formatWordsChars(selection, tb.showWordCount, tb.showCharCount)}
					</span>
				) : null}
				{tb.showReadingTime ? (
					<span>{formatReadingTime(selection)}</span>
				) : null}
				{tb.showClock ? <span>{clock}</span> : null}
				{tb.showTabCount ? (
					<span>
						{tabCount} tab{tabCount === 1 ? "" : "s"}
					</span>
				) : null}
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

function readRegister(): string {
	// Placeholder for the rebind/clipboard PR — cm-vim does not yet expose
	// the active register through its host API.
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

/**
 * File-path breadcrumb shown on the left of the top bar. Renders one
 * `BreadcrumbItem` per path segment with a folder icon for intermediate
 * segments and a file icon for the leaf. Slashes are used as separators
 * (overriding the shadcn default chevron) so the rendered path mirrors
 * the on-disk path style. Pseudo-paths like `(welcome)` render as a
 * single `welcome.org` leaf to match the previous label behavior.
 */
function FilePathBreadcrumb({
	vaultPath,
	activeFilePath,
}: {
	vaultPath: string;
	activeFilePath: string;
}) {
	const segments = pathSegments(vaultPath, activeFilePath);
	if (segments.length === 0) {
		return (
			<span
				className="no-drag-region max-w-[200px] truncate text-[11px] text-foreground"
				title={activeFilePath}
			>
				—
			</span>
		);
	}
	const leafIndex = segments.length - 1;
	return (
		<div
			className="no-drag-region min-w-0 max-w-[260px] truncate"
			title={activeFilePath}
		>
			<Breadcrumb>
				<BreadcrumbList className="flex-nowrap gap-1 text-[11px] text-foreground [&>li]:gap-1">
					{segments.map((seg, i) => {
						const isLeaf = i === leafIndex;
						const Icon = isLeaf
							? seg.endsWith(".org")
								? FileTextIcon
								: FileIcon
							: FolderIcon;
						const label = isLeaf ? stripOrgExt(seg) : seg;
						const segKey = segments.slice(0, i + 1).join("/");
						return (
							<Fragment key={segKey}>
								<BreadcrumbItem>
									<Icon className="size-3 shrink-0 opacity-70" />
									{isLeaf ? (
										<BreadcrumbPage className="truncate font-normal text-foreground">
											{label}
										</BreadcrumbPage>
									) : (
										<span className="truncate">{label}</span>
									)}
								</BreadcrumbItem>
								{isLeaf ? null : (
									<BreadcrumbSeparator className="text-muted-foreground/50 [&>svg]:hidden">
										/
									</BreadcrumbSeparator>
								)}
							</Fragment>
						);
					})}
				</BreadcrumbList>
			</Breadcrumb>
		</div>
	);
}

function pathSegments(vaultPath: string, filePath: string): string[] {
	if (!filePath) return [];
	if (filePath.startsWith("(") && filePath.endsWith(")")) {
		return [`${filePath.slice(1, -1)}.org`];
	}
	const rel = relativeTo(vaultPath, filePath);
	return rel.split("/").filter(Boolean);
}

function stripOrgExt(name: string): string {
	return name.endsWith(".org") ? name.slice(0, -4) : name;
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

/**
 * Compact `{N}words, {N} chars` formatter. When only one half is
 * enabled, returns just that half. Selection-aware: when a non-empty
 * range is selected, renders `selected/total` for the affected half.
 */
function formatWordsChars(
	selection: SelectionInfo | null,
	showWords: boolean,
	showChars: boolean,
): string {
	const parts: string[] = [];
	if (showWords) parts.push(formatWordsPart(selection));
	if (showChars) parts.push(formatCharsPart(selection));
	return parts.join(", ");
}

function formatWordsPart(selection: SelectionInfo | null): string {
	if (!selection) return "0words";
	const total = selection.totalWords.toLocaleString();
	if (selection.selectedWords > 0) {
		const sel = selection.selectedWords.toLocaleString();
		return `${sel}/${total}words`;
	}
	return `${total}words`;
}

function formatCharsPart(selection: SelectionInfo | null): string {
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
