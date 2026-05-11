import type { AgendaMode } from "../lib/agenda";
import type { OnOpenBlock, ViewBlock } from "../types";
import { AgendaCalendar } from "./AgendaCalendar";
import { EmptyState } from "./EmptyState";

interface AgendaViewProps {
	blocks: ViewBlock[];
	onOpenBlock?: OnOpenBlock;
	defaultMode?: AgendaMode;
	className?: string;
}

/**
 * Calendar-style agenda powered by Schedule-X. The host pumps the relevant
 * `blocks[]` (anything with a `scheduled` or `deadline` — the indexer can
 * pre-filter cheaply); this component owns the calendar instance and
 * surfaces day/week/month grids through Schedule-X's built-in views.
 */
export function AgendaView({
	blocks,
	onOpenBlock,
	defaultMode = "week",
	className,
}: AgendaViewProps) {
	const hasScheduled = blocks.some((b) => b.scheduled || b.deadline);

	return (
		<div className={`flex h-full flex-col text-sm ${className ?? ""}`}>
			{!hasScheduled ? (
				<EmptyState
					title="No scheduled items"
					body="Schedule a TODO with `<YYYY-MM-DD>` and it lands on the agenda."
					cta={
						<>
							<kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-[11px]">
								⌘K
							</kbd>{" "}
							→ <code className="font-mono">t buy milk friday</code>
						</>
					}
				/>
			) : (
				<AgendaCalendar
					blocks={blocks}
					defaultMode={defaultMode}
					onOpenBlock={onOpenBlock}
				/>
			)}
		</div>
	);
}
