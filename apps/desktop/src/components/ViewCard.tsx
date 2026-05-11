import {
	AgendaView,
	JournalView,
	TodosView,
	type ViewBlock,
} from "@gnosis/views";
import {
	CalendarRangeIcon,
	type LucideIcon,
	NotebookPenIcon,
	SquareCheckBigIcon,
	XIcon,
} from "lucide-react";

export type ViewKind = "journal" | "agenda" | "todos";

interface ViewCardProps {
	blocks: ViewBlock[];
	view: ViewKind;
	onClose(): void;
	className?: string;
	style?: import("react").CSSProperties;
}

const VIEW_META: Record<ViewKind, { label: string; icon: LucideIcon }> = {
	journal: { label: "Journal", icon: NotebookPenIcon },
	agenda: { label: "Agenda", icon: CalendarRangeIcon },
	todos: { label: "Todos", icon: SquareCheckBigIcon },
};

/**
 * Right-side companion to the editor card. One view per card — the host
 * swaps `view` when the user opens a different one (no tab strip lives
 * inside the card). Header only carries the view label and close button.
 */
export function ViewCard({
	blocks,
	view,
	onClose,
	className,
	style,
}: ViewCardProps) {
	const meta = VIEW_META[view];
	const Icon = meta.icon;
	return (
		<aside
			className={`flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm ${className ?? ""}`}
			style={style}
		>
			<header className="flex h-8 shrink-0 items-center gap-2 border-border/60 border-b px-3">
				<Icon className="size-3.5 text-muted-foreground" />
				<span className="font-medium text-[12px] text-foreground">
					{meta.label}
				</span>
				<button
					type="button"
					onClick={onClose}
					className="ml-auto inline-flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
					aria-label={`Close ${meta.label} view`}
				>
					<XIcon className="size-3" />
				</button>
			</header>
			<div className="min-h-0 flex-1 overflow-auto">
				{view === "journal" ? <JournalView blocks={blocks} /> : null}
				{view === "agenda" ? <AgendaView blocks={blocks} /> : null}
				{view === "todos" ? <TodosView blocks={blocks} /> : null}
			</div>
		</aside>
	);
}
