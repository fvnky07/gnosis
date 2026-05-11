import type { SelectionInfo } from "@gnosis/editor";
import { ModePill } from "@gnosis/vim-runtime";
import {
	CalendarRangeIcon,
	type LucideIcon,
	NotebookPenIcon,
	SearchIcon,
	Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
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
	onOpenPalette,
	onOpenView,
	className,
}: TopBarProps) {
	const tb = useSettings((s) => s.interface.topBar);
	const clock = useClock(tb.showClock);
	const fileLabel = formatFileLabel(vaultPath, activeFilePath);
	return (
		<div
			role="toolbar"
			aria-label="Top bar"
			className={`drag-region relative flex h-10 shrink-0 items-center px-4 pb-0 ${className ?? ""}`}
		>
			<div aria-hidden className="w-[72px] shrink-0" />

			{tb.showFilePath ? (
				<span
					className="no-drag-region max-w-[200px] truncate text-[11px] text-foreground"
					title={activeFilePath}
				>
					{fileLabel}
				</span>
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
					<kbd className="rounded bg-background px-1.5 text-muted-foreground text-sm">
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
				{tb.showWordCount ? <span>{formatWords(selection)}</span> : null}
				{tb.showCharCount ? <span>{formatChars(selection)}</span> : null}
				{tb.showReadingTime ? (
					<span>{formatReadingTime(selection)}</span>
				) : null}
				{tb.showClock ? <span>{clock}</span> : null}
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

function formatReadingTime(selection: SelectionInfo | null): string {
	const words = selection?.totalWords ?? 0;
	if (words === 0) return "0 min";
	const minutes = Math.max(1, Math.round(words / READING_WPM));
	return `${minutes} min read`;
}
