import { BlockSnippet } from "@gnosis/editor";
import { groupJournalBlocksByDay } from "../lib/journal";
import type { OnOpenBlock, ViewBlock } from "../types";
import { EmptyState } from "./EmptyState";

interface JournalViewProps {
	blocks: ViewBlock[];
	onOpenBlock?: OnOpenBlock;
	now?: Date;
	className?: string;
}

/**
 * Reverse-chronological feed of journal-tagged blocks grouped by day with
 * sticky day headers. The host filters / fetches; this component just
 * groups and renders.
 */
export function JournalView({
	blocks,
	onOpenBlock,
	now,
	className,
}: JournalViewProps) {
	const groups = groupJournalBlocksByDay(blocks, now);
	if (groups.length === 0) {
		return (
			<EmptyState
				className={className}
				title="Capture your first journal entry"
				body="Anything tagged :journal: lands here, grouped by day."
				cta={
					<>
						<kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-[11px]">
							⌘K
						</kbd>{" "}
						→ <code className="font-mono">j hello world</code>
					</>
				}
			/>
		);
	}
	return (
		<div
			className={`flex flex-col gap-4 overflow-auto p-4 text-sm ${className ?? ""}`}
		>
			{groups.map((group) => (
				<section key={group.dayMs}>
					<h3 className="sticky top-0 z-10 mb-2 bg-background/90 py-1 font-semibold text-muted-foreground text-xs backdrop-blur">
						{group.dayLabel}
					</h3>
					<ul className="space-y-2">
						{group.blocks.map((block) => (
							<li key={block.id}>
								<button
									type="button"
									onClick={(event) => {
										onOpenBlock?.(block, {
											newTab: event.metaKey || event.ctrlKey,
										});
									}}
									className="block w-full rounded-md border border-border/50 bg-card p-3 text-left transition hover:border-border hover:bg-accent"
								>
									<div className="mb-1 flex items-baseline justify-between gap-2">
										<span className="font-medium text-foreground">
											{block.headlineRaw.replace(/^\*+\s+/, "")}
										</span>
										<span className="shrink-0 text-muted-foreground text-xs">
											{block.filePath}
										</span>
									</div>
									{block.body.trim().length > 0 ? (
										<BlockSnippet
											text={block.body}
											className="text-muted-foreground text-xs"
										/>
									) : null}
									{block.tags.length > 0 ? (
										<div className="mt-1 flex flex-wrap gap-1">
											{block.tags.map((tag) => (
												<span
													key={tag}
													className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
												>
													:{tag}:
												</span>
											))}
										</div>
									) : null}
								</button>
							</li>
						))}
					</ul>
				</section>
			))}
		</div>
	);
}
