import { Command } from "cmdk";
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

/**
 * The CommandPalette React component. Wraps cmdk's headless `Command`
 * primitive and threads our provider engine through it. Filtering is
 * disabled at the cmdk level — providers do their own matching/scoring;
 * cmdk just renders + arrow-key cycles.
 *
 * The palette is uncontrolled wrt `open` from the host's perspective: the
 * host opens it (e.g. on `Cmd+K`) and the palette emits `onClose` when the
 * user submits, presses `Esc` from the root mode, or clicks outside.
 *
 * The full INSERT/LIST cursor behavior, sub-action lists, and preview pane
 * land alongside the FTS5 / `fileSearch` provider in phase 6b. The MVP
 * here ships the engine + the cmdk integration so vim, capture, view,
 * and `>` commands work end-to-end.
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
		<Command
			label="Command palette"
			shouldFilter={false}
			loop
			className={className}
			onKeyDown={(event) => {
				if (event.key === "Escape") {
					event.preventDefault();
					if (state.modeStack.length === 0) onClose();
					else dispatch({ type: "escape", total: flatItems.length });
				}
			}}
		>
			<Command.Input
				autoFocus
				value={state.query}
				onValueChange={(value) => dispatch({ type: "set-query", query: value })}
				placeholder="Type a command, > for commands, j/t/n to capture, v to open a view, ? for help…"
			/>
			<Command.List>
				{flatItems.length === 0 ? (
					<Command.Empty>{renderEmpty(state)}</Command.Empty>
				) : null}
				{results.map((bucket) => (
					<Command.Group key={bucket.providerId} heading={bucket.providerId}>
						{bucket.items.map((item) => (
							<Command.Item
								key={item.id}
								value={item.id}
								onSelect={(value) => {
									void handleSelect(value);
								}}
							>
								<span>{item.label}</span>
								{item.detail ? (
									<span className="ml-2 opacity-60">{item.detail}</span>
								) : null}
							</Command.Item>
						))}
					</Command.Group>
				))}
			</Command.List>
		</Command>
	);
}

function renderEmpty(state: PaletteState): string {
	if (state.query.trim() === "") {
		return "Type to search · > commands · f files · b blocks · j/t/n capture · v views · ? help";
	}
	return `No matches for "${state.query}"`;
}
