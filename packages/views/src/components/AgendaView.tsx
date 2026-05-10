import { useMemo, useState } from "react";
import { type AgendaMode, computeAgenda } from "../lib/agenda";
import { relativeDate } from "../lib/relative-date";
import type { OnOpenBlock, ViewBlock } from "../types";
import { EmptyState } from "./EmptyState";

interface AgendaViewProps {
	blocks: ViewBlock[];
	onOpenBlock?: OnOpenBlock;
	defaultMode?: AgendaMode;
	now?: Date;
	className?: string;
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Calendar-style agenda. The host pumps the relevant `blocks[]` (anything
 * with a `scheduled` or `deadline` in range — the indexer can pre-filter
 * cheaply via the SQL in `planning/10-views.md`). This component handles
 * mode switching and grid layout.
 */
export function AgendaView({
	blocks,
	onOpenBlock,
	defaultMode = "week",
	now,
	className,
}: AgendaViewProps) {
	const [mode, setMode] = useState<AgendaMode>(defaultMode);
	const range = useMemo(
		() => computeAgenda(blocks, { mode, now }),
		[blocks, mode, now],
	);
	const referenceNow = now ?? new Date();
	const hasScheduled = blocks.some((b) => b.scheduled || b.deadline);

	return (
		<div className={`flex h-full flex-col text-sm ${className ?? ""}`}>
			<div className="flex items-center justify-between border-border border-b px-3 py-2">
				<span className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">
					Agenda
				</span>
				<div className="flex gap-1 text-xs">
					{(["day", "week", "month"] as const).map((m) => (
						<button
							key={m}
							type="button"
							onClick={() => setMode(m)}
							className={`rounded px-2 py-1 ${
								mode === m
									? "bg-accent text-accent-foreground"
									: "text-muted-foreground hover:bg-muted"
							}`}
						>
							{m}
						</button>
					))}
				</div>
			</div>
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
			) : mode === "month" ? (
				<MonthGrid
					slots={range.slots}
					onOpenBlock={onOpenBlock}
					referenceNow={referenceNow}
				/>
			) : (
				<DayList
					slots={range.slots}
					onOpenBlock={onOpenBlock}
					referenceNow={referenceNow}
				/>
			)}
		</div>
	);
}

interface ListLikeProps {
	slots: ReturnType<typeof computeAgenda>["slots"];
	onOpenBlock?: OnOpenBlock;
	referenceNow: Date;
}

function DayList({ slots, onOpenBlock, referenceNow }: ListLikeProps) {
	return (
		<div className="flex flex-col gap-3 overflow-auto p-3">
			{slots.map((slot) => (
				<section key={slot.date.getTime()}>
					<h4 className="mb-2 font-mono text-muted-foreground text-xs">
						{slot.date.toLocaleDateString(undefined, {
							weekday: "short",
							month: "short",
							day: "numeric",
						})}{" "}
						<span className="opacity-60">
							{relativeDate(slot.date, referenceNow)}
						</span>
					</h4>
					{slot.blocks.length === 0 ? (
						<p className="text-muted-foreground/60 text-xs">No items.</p>
					) : (
						<ul className="space-y-1">
							{slot.blocks.map((block) => (
								<li key={`${slot.date.getTime()}-${block.id}`}>
									<AgendaChip block={block} onOpenBlock={onOpenBlock} />
								</li>
							))}
						</ul>
					)}
				</section>
			))}
		</div>
	);
}

function MonthGrid({ slots, onOpenBlock, referenceNow }: ListLikeProps) {
	return (
		<div className="grid grid-cols-7 gap-px bg-border">
			{DAY_LABELS.map((label) => (
				<div
					key={label}
					className="bg-background py-1 text-center font-medium text-muted-foreground text-xs"
				>
					{label}
				</div>
			))}
			{slots.map((slot) => {
				const isToday =
					slot.date.toDateString() === referenceNow.toDateString();
				return (
					<div
						key={slot.date.getTime()}
						className={`min-h-[80px] bg-background p-1 text-xs ${
							isToday ? "bg-accent/30" : ""
						}`}
					>
						<div className="font-mono text-[10px] text-muted-foreground">
							{slot.date.getDate()}
						</div>
						<ul className="mt-1 space-y-0.5">
							{slot.blocks.slice(0, 3).map((block) => (
								<li key={`${slot.date.getTime()}-${block.id}`}>
									<AgendaChip block={block} onOpenBlock={onOpenBlock} compact />
								</li>
							))}
							{slot.blocks.length > 3 ? (
								<li className="text-[10px] text-muted-foreground/60">
									+{slot.blocks.length - 3} more
								</li>
							) : null}
						</ul>
					</div>
				);
			})}
		</div>
	);
}

interface AgendaChipProps {
	block: ViewBlock;
	onOpenBlock?: OnOpenBlock;
	compact?: boolean;
}

function AgendaChip({ block, onOpenBlock, compact }: AgendaChipProps) {
	const stripeColor =
		block.priority === "A"
			? "border-l-red-500"
			: block.priority === "B"
				? "border-l-orange-500"
				: block.priority === "C"
					? "border-l-gray-400"
					: "border-l-transparent";
	return (
		<button
			type="button"
			onClick={(event) =>
				onOpenBlock?.(block, { newTab: event.metaKey || event.ctrlKey })
			}
			className={`flex w-full items-center gap-1 rounded-sm border-l-2 ${stripeColor} bg-card px-1.5 py-0.5 text-left hover:bg-accent ${compact ? "truncate" : ""}`}
		>
			<span className="truncate">
				{block.headlineRaw.replace(/^\*+\s+/, "")}
			</span>
		</button>
	);
}
