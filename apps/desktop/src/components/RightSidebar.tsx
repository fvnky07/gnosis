import {
	AgendaView,
	JournalView,
	TodosView,
	type ViewBlock,
} from "@gnosis/views";
import { useState } from "react";

export type ViewKind = "journal" | "agenda" | "todos";

interface RightSidebarProps {
	blocks: ViewBlock[];
	defaultView?: ViewKind;
	view?: ViewKind;
	onViewChange?: (v: ViewKind) => void;
	onClose?(): void;
	className?: string;
}

const TABS: { id: ViewKind; label: string }[] = [
	{ id: "journal", label: "Journal" },
	{ id: "agenda", label: "Agenda" },
	{ id: "todos", label: "Todos" },
];

/**
 * Single-column right sidebar containing the three views per
 * `planning/11-layout-and-shell.md`. Tabs at the top switch the active
 * view; collapsing/expanding the whole pane is the parent shell's job
 * (drag handle + `Cmd+Shift+B` toggle).
 *
 * Pass `view` + `onViewChange` for controlled mode (host owns the
 * active view, e.g. so palette `:view todos` and leader `Space v t`
 * can drive it). Omit them and the component falls back to internal
 * state seeded with `defaultView`.
 */
export function RightSidebar({
	blocks,
	defaultView = "journal",
	view,
	onViewChange,
	onClose,
	className,
}: RightSidebarProps) {
	const [internalActive, setInternalActive] = useState<ViewKind>(defaultView);
	const active = view ?? internalActive;
	const setActive = (next: ViewKind) => {
		if (onViewChange) onViewChange(next);
		else setInternalActive(next);
	};
	return (
		<aside
			className={`flex h-full flex-col border-border border-l bg-background ${className ?? ""}`}
		>
			<div className="flex items-center gap-1 border-border border-b px-2 py-1">
				{TABS.map((tab) => (
					<button
						key={tab.id}
						type="button"
						onClick={() => setActive(tab.id)}
						className={`rounded px-2 py-1 text-xs ${
							active === tab.id
								? "bg-accent text-accent-foreground"
								: "text-muted-foreground hover:bg-muted"
						}`}
					>
						{tab.label}
					</button>
				))}
				{onClose ? (
					<button
						type="button"
						onClick={onClose}
						className="ml-auto rounded px-2 py-1 text-muted-foreground text-xs hover:bg-muted"
						aria-label="Close right sidebar"
					>
						×
					</button>
				) : null}
			</div>
			<div className="min-h-0 flex-1">
				{active === "journal" ? <JournalView blocks={blocks} /> : null}
				{active === "agenda" ? <AgendaView blocks={blocks} /> : null}
				{active === "todos" ? <TodosView blocks={blocks} /> : null}
			</div>
		</aside>
	);
}
