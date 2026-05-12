import {
	type AgendaMode,
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

export type ViewKind =
	| "journal"
	| "agenda-day"
	| "agenda-month"
	| "agenda-year"
	| "todos";

interface ViewCardProps {
	blocks: ViewBlock[];
	view: ViewKind;
	onClose(): void;
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
	"agenda-month": {
		label: "Agenda · Month",
		icon: CalendarRangeIcon,
		agendaMode: "month",
	},
	"agenda-year": {
		label: "Agenda · Year",
		icon: CalendarRangeIcon,
		agendaMode: "year",
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
	className,
	style,
}: ViewCardProps) {
	const meta = VIEW_META[view];
	const Icon = meta.icon;
	return (
		<section
			className={`flex h-full min-h-0 w-full flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm ${className ?? ""}`}
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
					aria-label={`Close ${meta.label}`}
				>
					<XIcon className="size-3" />
				</button>
			</header>
			<div className="min-h-0 flex-1 overflow-auto">
				{view === "journal" ? <JournalView blocks={blocks} /> : null}
				{meta.agendaMode ? (
					<AgendaView blocks={blocks} defaultMode={meta.agendaMode} />
				) : null}
				{view === "todos" ? <TodosView blocks={blocks} /> : null}
			</div>
		</section>
	);
}
