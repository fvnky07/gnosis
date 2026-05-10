import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
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
 * primitives, mounted inside a shadcn radix `Dialog` so the popup gets
 * focus trap, scrim click-to-close, and Esc handling for free.
 *
 * Filtering is disabled at the cmdk level — providers do their own
 * matching/scoring; cmdk just renders + arrow-key cycles. Esc is
 * intercepted: pop the mode stack first; only when the stack is empty
 * does it bubble to the dialog close.
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
					"data-[state=open]:slide-in-from-top-4 top-[12vh] left-1/2 max-w-xl translate-x-[-50%] translate-y-0 gap-0 overflow-hidden rounded-lg border-border bg-popover p-0 text-popover-foreground shadow-2xl",
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
						placeholder="Type to search · > commands · f files · b blocks · j/t/n capture · v views · ? help"
					/>
					<CommandList>
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
			</DialogContent>
		</Dialog>
	);
}

function renderEmpty(state: PaletteState): string {
	if (state.query.trim() === "") {
		return "Type to search · > commands · f files · b blocks · j/t/n capture · v views · ? help";
	}
	return `No matches for "${state.query}"`;
}
