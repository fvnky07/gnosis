import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandShortcut,
} from "@gnosis/ui/components/command";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@gnosis/ui/components/dialog";
import { cn } from "@gnosis/ui/lib/utils";
import {
	ClockIcon,
	FilesIcon,
	FileTextIcon,
	HashIcon,
	HelpCircleIcon,
	LayoutGridIcon,
	ListIcon,
	type LucideIcon,
	PlusIcon,
	SettingsIcon,
	TerminalIcon,
} from "lucide-react";
import {
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useReducer,
	useRef,
	useState,
} from "react";
import type { CommandRegistry } from "./commands";
import { bumpFrecency, type FrecencyMap } from "./frecency";
import { type PaletteRegistry, queryProviders } from "./registry";
import { INITIAL_STATE, type PaletteState, paletteReducer } from "./state";
import type { PaletteCtx, PaletteItem } from "./types";

export type PalettePosition = "top" | "center";
export type PaletteBackdrop = "none" | "dim" | "blur";

export interface PaletteAppearance {
	position?: PalettePosition;
	/** vh from the top of the viewport. Only honored when position === "top". */
	topOffsetVh?: number;
	/** Width in px (overrides the default `max-w-xl`). */
	widthPx?: number;
	backdrop?: PaletteBackdrop;
	/** Maximum entries the rendered command list keeps. Anything beyond this
	 *  is truncated so a 1000-item provider can't tank the dialog. */
	resultLimit?: number;
	/** When true, the palette retains the last-typed query across opens. */
	preserveQueryOnReopen?: boolean;
}

interface CommandPaletteProps {
	registry: PaletteRegistry;
	commandRegistry: CommandRegistry;
	ctx: PaletteCtx;
	open: boolean;
	onClose(): void;
	/** Optional one-shot query to seed when the palette opens. Useful for
	 * the vim `:` / `/` bridge — the editor opens the palette and pre-fills
	 * the input with `>` or `b ` so the user is one keystroke from a match. */
	seed?: string;
	frecency?: FrecencyMap;
	onFrecencyChange?(next: FrecencyMap): void;
	className?: string;
	/** Persisted UI knobs from the desktop settings store. Unset values
	 *  fall back to the previous hard-coded defaults. */
	appearance?: PaletteAppearance;
	/** Invoked when the user presses ⌘N inside the palette. Host wires this
	 *  to its own new-buffer / new-tab flow. */
	onNewBuffer?(): void;
}

interface ProviderResult {
	providerId: string;
	items: PaletteItem[];
}

const PROVIDER_LABELS: Record<string, string> = {
	help: "Help",
	capture: "Capture",
	view: "Views",
	"recent-files": "Recent",
	commands: "Commands",
	files: "Files",
	blocks: "Blocks",
	outline: "Outline",
	tabs: "Open buffers",
};

const PROVIDER_ICONS: Record<string, LucideIcon> = {
	help: HelpCircleIcon,
	capture: PlusIcon,
	view: LayoutGridIcon,
	"recent-files": ClockIcon,
	commands: TerminalIcon,
	files: FileTextIcon,
	blocks: HashIcon,
	outline: ListIcon,
	tabs: FilesIcon,
};

/** Section-label → icon. Used when an item carries an explicit `section`
 * (e.g. items emitted by the root-menu provider). Falls back to the
 * provider icon if the section has no entry here. */
const SECTION_ICONS: Record<string, LucideIcon> = {
	Navigation: FileTextIcon,
	Views: LayoutGridIcon,
	Capture: PlusIcon,
	Actions: SettingsIcon,
	Hotkeys: TerminalIcon,
	Help: HelpCircleIcon,
};

/**
 * The CommandPalette React component. Each row renders as
 * `[icon] [label] [shortcut]` — the same shape as the shadcn
 * CommandManyItems example. Filtering is disabled at the cmdk level
 * since providers do their own scoring; cmdk handles arrow-key cycling.
 */
export function CommandPalette({
	registry,
	ctx,
	open,
	onClose,
	seed,
	frecency = {},
	onFrecencyChange,
	className,
	appearance,
	onNewBuffer,
}: CommandPaletteProps): ReactNode {
	const position: PalettePosition = appearance?.position ?? "top";
	const topOffsetVh = appearance?.topOffsetVh ?? 14;
	const widthPx = appearance?.widthPx ?? 576; // matches former max-w-xl
	const backdrop: PaletteBackdrop = appearance?.backdrop ?? "blur";
	const resultLimit = Math.max(1, appearance?.resultLimit ?? 50);
	const [state, dispatch] = useReducer(paletteReducer, INITIAL_STATE);
	const [results, setResults] = useState<ProviderResult[]>([]);
	const lastQueryRef = useRef("");

	useEffect(() => {
		if (open && !state.open) {
			dispatch({ type: "open" });
			if (seed) {
				dispatch({ type: "set-query", query: seed });
			} else if (appearance?.preserveQueryOnReopen && lastQueryRef.current) {
				dispatch({ type: "set-query", query: lastQueryRef.current });
			}
		}
		if (!open && state.open) {
			if (appearance?.preserveQueryOnReopen) {
				lastQueryRef.current = state.query;
			}
			dispatch({ type: "close" });
		}
	}, [open, state.open, state.query, seed, appearance?.preserveQueryOnReopen]);

	useEffect(() => {
		if (!state.open) return;
		const controller = new AbortController();
		(async () => {
			const merged = await queryProviders(
				registry,
				state.mode,
				state.query,
				controller.signal,
				ctx,
			);
			if (controller.signal.aborted) return;
			setResults(
				merged.map((m) => ({ providerId: m.provider.id, items: m.items })),
			);
		})();
		return () => {
			controller.abort();
		};
	}, [registry, state.open, state.mode, state.query, ctx]);

	const flatItems = useMemo<PaletteItem[]>(
		() => results.flatMap((r) => r.items),
		[results],
	);

	const handleSelect = useCallback(
		async (itemId: string) => {
			const flat: { providerId: string; item: PaletteItem }[] = [];
			for (const r of results) {
				for (const item of r.items)
					flat.push({ providerId: r.providerId, item });
			}
			const found = flat.find((entry) => entry.item.id === itemId);
			if (!found) return;
			// Items in the root menu may carry a `seed` prefix — selecting them
			// fills the input with that prefix and keeps the palette open so
			// the matching sub-provider takes over. No frecency bump because
			// the user isn't done picking yet.
			const seed = found.item.meta?.seed;
			if (typeof seed === "string" && seed.length > 0) {
				dispatch({ type: "set-query", query: seed });
				return;
			}
			const provider = registry.get(found.providerId);
			if (!provider) return;
			if (onFrecencyChange) {
				onFrecencyChange(bumpFrecency(frecency, itemId));
			}
			await provider.onSubmit(found.item, ctx);
			onClose();
		},
		[results, registry, ctx, onClose, frecency, onFrecencyChange],
	);

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				if (!next) onClose();
			}}
		>
			<DialogContent
				showCloseButton={false}
				onEscapeKeyDown={(event) => {
					if (state.modeStack.length > 0) {
						event.preventDefault();
						dispatch({ type: "escape", total: flatItems.length });
					}
				}}
				onKeyDownCapture={(event) => {
					const mod = event.metaKey || event.ctrlKey;
					if (mod && !event.shiftKey && event.key.toLowerCase() === "n") {
						event.preventDefault();
						event.stopPropagation();
						onNewBuffer?.();
						onClose();
					}
				}}
				style={
					position === "center"
						? {
								top: "50%",
								translate: "-50% -50%",
								transform: "none",
								width: `${widthPx}px`,
								maxWidth: `${widthPx}px`,
							}
						: {
								top: `${topOffsetVh}vh`,
								translate: "-50% 0",
								transform: "none",
								width: `${widthPx}px`,
								maxWidth: `${widthPx}px`,
							}
				}
				className={cn(
					"data-[state=open]:slide-in-from-top-4 left-1/2 gap-0 overflow-hidden rounded-xl border border-border p-0 text-popover-foreground shadow-2xl ring-1 ring-black/5",
					backdrop === "blur"
						? "bg-popover/95 backdrop-blur-xl"
						: backdrop === "dim"
							? "bg-popover"
							: "bg-popover",
					className,
				)}
			>
				<DialogHeader className="sr-only">
					<DialogTitle>Command palette</DialogTitle>
					<DialogDescription>
						Search files, commands, views, and capture targets.
					</DialogDescription>
				</DialogHeader>
				<Command label="Command palette" shouldFilter={false} loop>
					<CommandInput
						autoFocus
						value={state.query}
						onValueChange={(value) =>
							dispatch({ type: "set-query", query: value })
						}
						placeholder="Type a command or search…"
						className="text-[14px]"
						trailing={
							state.query.trim().length > 0 && flatItems.length > 0 ? (
								<span className="select-none text-[10px] text-muted-foreground tabular-nums">
									{flatItems.length}
								</span>
							) : null
						}
					/>
					<CommandList className="max-h-[60vh]">
						{onNewBuffer ? (
							<CommandGroup
								heading={
									state.query.trim().length > 0 ? undefined : "Quick actions"
								}
							>
								<CommandItem
									value="__action.new-buffer"
									onSelect={() => {
										onNewBuffer();
										onClose();
									}}
									className="gap-2.5 py-2"
								>
									<PlusIcon className="size-4 shrink-0 text-muted-foreground" />
									<div className="flex min-w-0 flex-1 flex-col">
										<span className="truncate text-[13px] leading-tight">
											New buffer
										</span>
										<span className="truncate text-[11px] text-muted-foreground leading-tight">
											Open a fresh scratch tab
										</span>
									</div>
									<CommandShortcut className="text-[11px]">⌘N</CommandShortcut>
								</CommandItem>
							</CommandGroup>
						) : null}
						{flatItems.length === 0 ? (
							<CommandEmpty>{renderEmpty(state)}</CommandEmpty>
						) : null}
						{groupBySection(results, resultLimit).map((group) => (
							<CommandGroup
								key={group.key}
								heading={
									state.query.trim().length > 0 ? undefined : group.heading
								}
							>
								{group.entries.map((entry) => (
									<PaletteRow
										key={entry.item.id}
										item={entry.item}
										providerId={entry.providerId}
										onSelect={handleSelect}
									/>
								))}
							</CommandGroup>
						))}
					</CommandList>
					<div className="flex h-7 items-center justify-end border-border/60 border-t px-3 font-mono text-[10px] text-muted-foreground">
						<span className="shrink-0">↵ select · esc close</span>
					</div>
				</Command>
			</DialogContent>
		</Dialog>
	);
}

interface PaletteRowProps {
	item: PaletteItem;
	providerId: string;
	onSelect(itemId: string): void;
}

function PaletteRow({ item, providerId, onSelect }: PaletteRowProps) {
	const shortcut = item.meta?.shortcut as string | undefined;
	return (
		<CommandItem
			value={item.id}
			onSelect={(value) => onSelect(value)}
			className="gap-2.5 py-2"
		>
			<PaletteIcon item={item} providerId={providerId} />
			<div className="flex min-w-0 flex-1 flex-col">
				<span className="truncate text-[13px] leading-tight">{item.label}</span>
				{item.detail ? (
					<span className="truncate text-[11px] text-muted-foreground leading-tight">
						{item.detail}
					</span>
				) : null}
			</div>
			{shortcut ? (
				<CommandShortcut className="font-mono text-[11px]">
					{shortcut}
				</CommandShortcut>
			) : null}
		</CommandItem>
	);
}

function PaletteIcon({
	item,
	providerId,
}: {
	item: PaletteItem;
	providerId: string;
}): ReactNode {
	if (item.icon) return <span className="size-4 shrink-0">{item.icon}</span>;
	if (
		item.id?.startsWith("command:settings") ||
		item.id === "root.action.settings"
	)
		return <SettingsIcon className="size-4 shrink-0 text-muted-foreground" />;
	const iconKey = item.meta?.iconKey as string | undefined;
	if (iconKey && PROVIDER_ICONS[iconKey]) {
		const Icon = PROVIDER_ICONS[iconKey];
		return <Icon className="size-4 shrink-0 text-muted-foreground" />;
	}
	if (item.section && SECTION_ICONS[item.section]) {
		const Icon = SECTION_ICONS[item.section];
		return <Icon className="size-4 shrink-0 text-muted-foreground" />;
	}
	const Icon = PROVIDER_ICONS[providerId];
	if (!Icon) return null;
	return <Icon className="size-4 shrink-0 text-muted-foreground" />;
}

interface SectionGroup {
	key: string;
	heading: string;
	entries: { item: PaletteItem; providerId: string }[];
}

/**
 * Group merged provider results into rendered sections. Items that carry
 * an explicit `section` field (e.g. root-menu items) drive the heading
 * directly; everything else falls back to its provider label. Order is
 * preserved from the input so provider rank still controls the visual
 * order.
 */
function groupBySection(
	results: ProviderResult[],
	limit = Number.POSITIVE_INFINITY,
): SectionGroup[] {
	const groups = new Map<string, SectionGroup>();
	let total = 0;
	outer: for (const bucket of results) {
		for (const item of bucket.items) {
			const heading =
				item.section ?? PROVIDER_LABELS[bucket.providerId] ?? bucket.providerId;
			const key = `${heading}::${bucket.providerId}`;
			let group = groups.get(key);
			if (!group) {
				group = { key, heading, entries: [] };
				groups.set(key, group);
			}
			group.entries.push({ item, providerId: bucket.providerId });
			total += 1;
			if (total >= limit) break outer;
		}
	}
	return Array.from(groups.values());
}

function renderEmpty(state: PaletteState): string {
	const raw = state.query;
	if (raw.trim() === "") {
		return "Type to search…";
	}
	const hint = prefixHint(raw);
	if (hint) return hint;
	return `No matches for "${raw}"`;
}

/** Prefix-aware empty-state copy. After a sub-provider trigger like
 * `j `, `f `, `?` etc. the user has committed to a sub-mode — show the
 * matching call-to-action instead of "No matches", which reads as an
 * error when in reality the provider is just waiting on text. */
function prefixHint(query: string): string | null {
	if (/^j\s/.test(query)) return "Type the journal entry and press Enter";
	if (/^t\s/.test(query)) return "Type the task title and press Enter";
	if (/^n\s/.test(query)) return "Type the note text and press Enter";
	if (/^f\s/.test(query)) return "Type to fuzzy-search vault files";
	if (/^b\s/.test(query)) return "Type to full-text search blocks";
	if (/^o\s/.test(query)) return "No headings in the active buffer";
	if (/^v\s/.test(query)) return "Pick a view: journal · agenda · todos";
	if (/^tabs(\s|$)/.test(query)) return "Type to filter open buffers";
	if (/^>/.test(query)) return "Type to filter commands";
	if (/^\?/.test(query)) return "Palette quick reference";
	return null;
}
