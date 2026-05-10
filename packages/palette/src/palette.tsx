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
	useState,
} from "react";
import type { CommandRegistry } from "./commands";
import { bumpFrecency, type FrecencyMap } from "./frecency";
import { type PaletteRegistry, queryProviders } from "./registry";
import { INITIAL_STATE, type PaletteState, paletteReducer } from "./state";
import type { PaletteCtx, PaletteItem } from "./types";

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

const FOOTER_HINT =
	"> commands · f files · b blocks · j/t/n capture · v views · ? help";

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
}: CommandPaletteProps): ReactNode {
	const [state, dispatch] = useReducer(paletteReducer, INITIAL_STATE);
	const [results, setResults] = useState<ProviderResult[]>([]);

	useEffect(() => {
		if (open && !state.open) {
			dispatch({ type: "open" });
			if (seed) dispatch({ type: "set-query", query: seed });
		}
		if (!open && state.open) dispatch({ type: "close" });
	}, [open, state.open, seed]);

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
				className={cn(
					"data-[state=open]:slide-in-from-top-4 top-[14vh] left-1/2 max-w-xl translate-x-[-50%] translate-y-0 gap-0 overflow-hidden rounded-xl border border-border/70 bg-popover/95 p-0 text-popover-foreground shadow-2xl ring-1 ring-black/5 backdrop-blur-xl",
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
					/>
					<CommandList className="max-h-[60vh]">
						{flatItems.length === 0 ? (
							<CommandEmpty>{renderEmpty(state)}</CommandEmpty>
						) : null}
						{results.map((bucket) => (
							<CommandGroup
								key={bucket.providerId}
								heading={
									PROVIDER_LABELS[bucket.providerId] ?? bucket.providerId
								}
							>
								{bucket.items.map((item) => (
									<PaletteRow
										key={item.id}
										item={item}
										providerId={bucket.providerId}
										onSelect={handleSelect}
									/>
								))}
							</CommandGroup>
						))}
					</CommandList>
					<div className="flex h-7 items-center justify-between border-border/60 border-t px-3 font-mono text-[10px] text-muted-foreground">
						<span className="truncate">{FOOTER_HINT}</span>
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
	if (item.id?.startsWith("command:settings"))
		return <SettingsIcon className="size-4 shrink-0 text-muted-foreground" />;
	const Icon = PROVIDER_ICONS[providerId];
	if (!Icon) return null;
	return <Icon className="size-4 shrink-0 text-muted-foreground" />;
}

function renderEmpty(state: PaletteState): string {
	if (state.query.trim() === "") {
		return FOOTER_HINT;
	}
	return `No matches for "${state.query}"`;
}
