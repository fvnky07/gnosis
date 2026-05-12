import type { ReactNode } from "react";
import type { AgendaMode } from "../lib/agenda";
import type { OnOpenBlock, ViewBlock } from "../types";
import { AgendaCalendar } from "./AgendaCalendar";

interface AgendaViewProps {
	blocks: ViewBlock[];
	onOpenBlock?: OnOpenBlock;
	defaultMode?: AgendaMode;
	className?: string;
	/** Slotted into Schedule-X's header before the Today/nav cluster. */
	headerLeading?: ReactNode;
	/** Slotted into Schedule-X's header after the view/date cluster. */
	headerTrailing?: ReactNode;
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
	headerLeading,
	headerTrailing,
}: AgendaViewProps) {
	return (
		<div className={`flex h-full flex-col text-sm ${className ?? ""}`}>
			<AgendaCalendar
				blocks={blocks}
				defaultMode={defaultMode}
				onOpenBlock={onOpenBlock}
				headerLeading={headerLeading}
				headerTrailing={headerTrailing}
			/>
		</div>
	);
}
