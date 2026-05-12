import {
	type AgendaMode,
	AgendaView,
	JournalView,
	type OnOpenBlock,
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

export type ViewKind =
	| "journal"
	| "agenda-day"
	| "agenda-week"
	| "agenda-month"
	| "todos";

interface ViewCardProps {
	blocks: ViewBlock[];
	view: ViewKind;
	onClose(): void;
	onOpenBlock?: OnOpenBlock;
	className?: string;
	style?: import("react").CSSProperties;
}

const VIEW_META: Record<
	ViewKind,
	{ label: string; icon: LucideIcon; agendaMode?: AgendaMode }
> = {
	journal: { label: "Journal", icon: NotebookPenIcon },
	"agenda-day": {
		label: "Agenda · Day",
		icon: CalendarRangeIcon,
		agendaMode: "day",
	},
	"agenda-week": {
		label: "Agenda · Week",
		icon: CalendarRangeIcon,
		agendaMode: "week",
	},
	"agenda-month": {
		label: "Agenda · Month",
		icon: CalendarRangeIcon,
		agendaMode: "month",
	},
	todos: { label: "Todos", icon: SquareCheckBigIcon },
};

/**
 * Card wrapper for a single view. Renders as a pane inside the workspace
 * track; sizing belongs to the parent (`PaneShell` / `<main>` flex row).
 */
export function ViewCard({
	blocks,
	view,
	onClose,
	onOpenBlock,
	className,
	style,
}: ViewCardProps) {
	const meta = VIEW_META[view];
	const Icon = meta.icon;
	const isAgenda = meta.agendaMode !== undefined;

	// Agenda mounts its own pill header (the icon + label slot into
	// Schedule-X's header alongside Today/range/view/date), so the outer
	// `<section>` skips the second header bar to keep the visual a single row.
	const agendaLeading = isAgenda ? (
		<div className="sx-pill-leading flex items-center gap-2">
			<Icon className="size-3.5 text-muted-foreground" />
			<span className="font-medium text-[12px] text-foreground">
				{meta.label}
			</span>
		</div>
	) : null;
	const agendaTrailing = isAgenda ? (
		<button
			type="button"
			onClick={onClose}
			className="sx-pill-trailing inline-flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
			aria-label={`Close ${meta.label}`}
		>
			<XIcon className="size-3" />
		</button>
	) : null;

	return (
		<section
			className={`flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm ${className ?? ""}`}
			style={style}
		>
			{!isAgenda ? (
				<header className="flex h-8 shrink-0 items-center gap-2 border-border/60 border-b px-3">
					<Icon className="size-3.5 text-muted-foreground" />
					<span className="font-medium text-[12px] text-foreground">
						{meta.label}
					</span>
					<button
						type="button"
						onClick={onClose}
						className="ml-auto inline-flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
						aria-label={`Close ${meta.label}`}
					>
						<XIcon className="size-3" />
					</button>
				</header>
			) : null}
			<div className="min-h-0 flex-1 overflow-auto">
				{view === "journal" ? <JournalView blocks={blocks} /> : null}
				{meta.agendaMode ? (
					<AgendaView
						blocks={blocks}
						defaultMode={meta.agendaMode}
						onOpenBlock={onOpenBlock}
						headerLeading={agendaLeading}
						headerTrailing={agendaTrailing}
					/>
				) : null}
				{view === "todos" ? <TodosView blocks={blocks} /> : null}
			</div>
		</section>
	);
}
