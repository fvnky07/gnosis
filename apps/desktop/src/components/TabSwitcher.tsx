interface Tab {
	id: string;
	title: string;
	filePath: string;
}

interface TabSwitcherProps {
	tabs: ReadonlyArray<Tab>;
	open: boolean;
	selectedIndex: number;
	onSelectedIndexChange: (i: number) => void;
	onCommit: (tabId: string) => void;
	onCancel: () => void;
}

/**
 * MRU tab cycler overlay. Renders while `Ctrl` is held; the parent (App.tsx)
 * owns key listening — Ctrl+Tab advances `selectedIndex`, releasing Ctrl
 * calls `onCommit` with the selected tab id, Escape calls `onCancel`.
 *
 * Pure rendering: no internal key handlers, fully testable in isolation.
 */
export function TabSwitcher({
	tabs,
	open,
	selectedIndex,
	onSelectedIndexChange,
	onCommit,
	// biome-ignore lint/correctness/noUnusedFunctionParameters: parent owns Escape; kept for API symmetry
	onCancel,
}: TabSwitcherProps) {
	if (!open) return null;

	return (
		<div
			data-testid="tab-switcher"
			role="dialog"
			aria-modal="true"
			aria-label="Switch tab"
			className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-black/40"
		>
			<div className="pointer-events-auto min-w-[400px] rounded-lg border border-border bg-popover p-4 shadow-2xl">
				<p className="mb-2 font-semibold text-[11px] text-muted-foreground uppercase tracking-wider">
					Recent tabs
				</p>
				<div role="listbox" aria-label="Open tabs">
					{tabs.map((tab, idx) => {
						const isSelected = idx === selectedIndex;
						return (
							<button
								type="button"
								role="option"
								key={tab.id}
								aria-selected={isSelected}
								data-selected={isSelected ? "true" : undefined}
								className={`flex w-full cursor-pointer flex-col rounded px-3 py-1.5 text-left ${
									isSelected
										? "bg-accent text-accent-foreground"
										: "text-popover-foreground hover:bg-muted"
								}`}
								onClick={() => {
									onSelectedIndexChange(idx);
									onCommit(tab.id);
								}}
							>
								<span className="truncate font-medium text-sm leading-snug">
									{tab.title}
								</span>
								<span className="truncate font-mono text-[11px] text-muted-foreground">
									{tab.filePath}
								</span>
							</button>
						);
					})}
					{tabs.length === 0 && (
						<p className="px-3 py-2 text-muted-foreground text-sm">
							No open tabs
						</p>
					)}
				</div>
			</div>
		</div>
	);
}

export default TabSwitcher;
