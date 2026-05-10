import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@gnosis/ui/components/command";
import { cn } from "@gnosis/ui/lib/utils";
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
};

/**
 * The CommandPalette React component. Wraps cmdk via the shadcn `Command`
 * primitives so the popup matches the rest of the UI: backdrop, rounded
 * popover, sectioned groups, keyboard cycling, accent on the selected row.
 *
 * Filtering is disabled at the cmdk level — providers do their own
 * matching/scoring; cmdk just renders + arrow-key cycles.
 *
 * The host opens it (e.g. on `Cmd+K`) and the palette emits `onClose` when
 * the user submits, presses `Esc` from the root mode, or clicks the
 * backdrop.
 */
export function CommandPalette({
	registry,
	ctx,
	open,
	onClose,
	frecency = {},
	onFrecencyChange,
	className,
}: CommandPaletteProps): ReactNode {
	const [state, dispatch] = useReducer(paletteReducer, INITIAL_STATE);
	const [results, setResults] = useState<ProviderResult[]>([]);

	useEffect(() => {
		if (open && !state.open) dispatch({ type: "open" });
		if (!open && state.open) dispatch({ type: "close" });
	}, [open, state.open]);

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

	if (!state.open) return null;

	return (
		<div
			data-slot="command-palette-root"
			className="fixed inset-0 z-50 flex items-start justify-center"
		>
			<button
				type="button"
				aria-label="Close palette"
				onClick={onClose}
				className="absolute inset-0 cursor-default bg-black/40 backdrop-blur-sm"
			/>
			<Command
				label="Command palette"
				shouldFilter={false}
				loop
				className={cn(
					"relative z-10 mt-[12vh] w-full max-w-xl overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-2xl",
					className,
				)}
				onKeyDown={(event) => {
					if (event.key === "Escape") {
						event.preventDefault();
						if (state.modeStack.length === 0) onClose();
						else dispatch({ type: "escape", total: flatItems.length });
					}
				}}
			>
				<CommandInput
					autoFocus
					value={state.query}
					onValueChange={(value) =>
						dispatch({ type: "set-query", query: value })
					}
					placeholder="Type to search · > commands · f files · b blocks · j/t/n capture · v views · ? help"
				/>
				<CommandList>
					{flatItems.length === 0 ? (
						<CommandEmpty>{renderEmpty(state)}</CommandEmpty>
					) : null}
					{results.map((bucket) => (
						<CommandGroup
							key={bucket.providerId}
							heading={PROVIDER_LABELS[bucket.providerId] ?? bucket.providerId}
						>
							{bucket.items.map((item) => (
								<CommandItem
									key={item.id}
									value={item.id}
									onSelect={(value) => {
										void handleSelect(value);
									}}
								>
									<span className="truncate">{item.label}</span>
									{item.detail ? (
										<span className="ml-auto truncate text-muted-foreground text-xs">
											{item.detail}
										</span>
									) : null}
								</CommandItem>
							))}
						</CommandGroup>
					))}
				</CommandList>
			</Command>
		</div>
	);
}

function renderEmpty(state: PaletteState): string {
	if (state.query.trim() === "") {
		return "Type to search · > commands · f files · b blocks · j/t/n capture · v views · ? help";
	}
	return `No matches for "${state.query}"`;
}
