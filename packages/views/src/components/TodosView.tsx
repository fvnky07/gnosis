import { useMemo, useState } from "react";
import { parseOrgDate, relativeDate } from "../lib/relative-date";
import { buildKanbanColumns, sortTodosListMode } from "../lib/todos";
import type { OnOpenBlock, ViewBlock } from "../types";

interface TodosViewProps {
	blocks: ViewBlock[];
	onOpenBlock?: OnOpenBlock;
	defaultMode?: "kanban" | "list";
	now?: Date;
	className?: string;
}

/**
 * Tasks view per `planning/10-views.md`. Kanban (Backlog / Active / Done)
 * by default, with a flat-list mode toggle. Drag-to-rebucket is deferred
 * until splice-based timestamp edits land (issue V3); for now everything
 * is read-only — clicks navigate to source.
 */
export function TodosView({
	blocks,
	onOpenBlock,
	defaultMode = "kanban",
	now,
	className,
}: TodosViewProps) {
	const [mode, setMode] = useState<"kanban" | "list">(defaultMode);
	const referenceNow = now ?? new Date();

	const kanban = useMemo(
		() => buildKanbanColumns(blocks, { now: referenceNow }),
		[blocks, referenceNow],
	);
	const list = useMemo(() => sortTodosListMode(blocks), [blocks]);

	return (
		<div className={`flex h-full flex-col text-sm ${className ?? ""}`}>
			<div className="flex items-center justify-between border-border border-b px-3 py-2">
				<span className="font-semibold text-muted-foreground text-xs uppercase tracking-wide">
					Todos
				</span>
				<div className="flex gap-1 text-xs">
					{(["kanban", "list"] as const).map((m) => (
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
			{mode === "kanban" ? (
				<div className="flex h-full gap-2 overflow-auto p-2">
					{kanban.map((column) => (
						<section
							key={column.id}
							className="flex min-w-[12rem] flex-1 flex-col rounded-md border border-border/60 bg-muted/30"
						>
							<header className="border-border/50 border-b px-2 py-1 font-semibold text-muted-foreground text-xs">
								{column.title}{" "}
								<span className="opacity-50">({column.blocks.length})</span>
							</header>
							<ul className="flex-1 space-y-1 overflow-auto p-1">
								{column.blocks.map((block) => (
									<li key={block.id}>
										<TodoCard
											block={block}
											onOpenBlock={onOpenBlock}
											referenceNow={referenceNow}
										/>
									</li>
								))}
							</ul>
						</section>
					))}
				</div>
			) : (
				<ul className="flex-1 space-y-1 overflow-auto p-2">
					{list.map((block) => (
						<li key={block.id}>
							<TodoCard
								block={block}
								onOpenBlock={onOpenBlock}
								referenceNow={referenceNow}
							/>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

interface TodoCardProps {
	block: ViewBlock;
	onOpenBlock?: OnOpenBlock;
	referenceNow: Date;
}

function TodoCard({ block, onOpenBlock, referenceNow }: TodoCardProps) {
	const stripe =
		block.priority === "A"
			? "border-l-red-500"
			: block.priority === "B"
				? "border-l-orange-500"
				: block.priority === "C"
					? "border-l-gray-400"
					: "border-l-transparent";
	const scheduled = parseOrgDate(block.scheduled);
	const deadline = parseOrgDate(block.deadline);
	const due = deadline ?? scheduled;
	return (
		<button
			type="button"
			onClick={(event) =>
				onOpenBlock?.(block, { newTab: event.metaKey || event.ctrlKey })
			}
			className={`flex w-full flex-col gap-1 rounded-sm border-l-2 ${stripe} bg-card p-2 text-left hover:bg-accent`}
		>
			<span className="font-medium">
				{block.headlineRaw.replace(/^\*+\s+(?:TODO|DONE)?\s*/, "")}
			</span>
			<span className="flex items-center justify-between text-muted-foreground text-xs">
				<span>{block.filePath}</span>
				{due ? <span>{relativeDate(due, referenceNow)}</span> : null}
			</span>
			{block.tags.length > 0 ? (
				<div className="flex flex-wrap gap-1">
					{block.tags.map((tag) => (
						<span
							key={tag}
							className="rounded bg-muted px-1 font-mono text-[10px] text-muted-foreground"
						>
							:{tag}:
						</span>
					))}
				</div>
			) : null}
		</button>
	);
}
