import type { ViewBlock } from "@gnosis/views";
import { useEffect, useRef } from "react";

interface BlockDetailsPopoverProps {
	block: ViewBlock | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	anchor?: { x: number; y: number } | null;
}

/**
 * Floating popover that shows all metadata for a single `ViewBlock`.
 * Positioned at the provided screen-space `anchor` coordinate (e.g. the
 * editor caret position). When `anchor` is null the panel floats near the
 * viewport centre.
 *
 * Implementation note: `@radix-ui/react-popover` is not a direct dependency
 * of `@gnosis/desktop` (it lives in `@gnosis/ui`'s transitive deps), so this
 * component uses a controlled `position:fixed` overlay rather than Radix
 * primitives. Wave 2 can swap in a Radix Popover once `@gnosis/ui` exports
 * one.
 */
export function BlockDetailsPopover({
	block,
	open,
	onOpenChange,
	anchor,
}: BlockDetailsPopoverProps) {
	const panelRef = useRef<HTMLDivElement>(null);

	// Close on Escape key
	useEffect(() => {
		if (!open) return;
		const handler = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				onOpenChange(false);
			}
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [open, onOpenChange]);

	if (!open || !block) return null;

	// Resolve position: anchor coord or viewport centre fallback
	const left = anchor != null ? anchor.x : "50%";
	const top = anchor != null ? anchor.y : "50%";
	const transform =
		anchor != null ? "translate(8px, 8px)" : "translate(-50%, -50%)";

	const TODO_COLORS: Record<string, string> = {
		TODO: "bg-amber-500/20 text-amber-700 dark:text-amber-300",
		DONE: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300",
	};
	const PRIORITY_COLORS: Record<string, string> = {
		A: "bg-rose-500/20 text-rose-700 dark:text-rose-300",
		B: "bg-amber-500/20 text-amber-700 dark:text-amber-300",
		C: "bg-blue-500/20 text-blue-700 dark:text-blue-300",
	};

	return (
		<>
			{/* Backdrop — click-away closes the popover */}
			<div
				className="fixed inset-0 z-40"
				aria-hidden="true"
				onClick={() => onOpenChange(false)}
			/>

			{/* Panel */}
			<div
				ref={panelRef}
				role="dialog"
				aria-modal="true"
				aria-label="Block details"
				className="fixed z-50 flex max-h-[70vh] w-[480px] max-w-[calc(100vw-2rem)] flex-col gap-3 overflow-y-auto rounded-md border border-border bg-popover p-4 text-popover-foreground shadow-lg"
				style={{ left, top, transform }}
			>
				{/* Headline */}
				<h2 className="font-bold text-base leading-snug">
					{block.headlineRaw}
				</h2>

				{/* Pills row */}
				{(block.todoState != null || block.priority != null) && (
					<div className="flex items-center gap-2">
						{block.todoState != null && (
							<span
								className={`rounded px-1.5 py-0.5 font-mono font-semibold text-xs ${TODO_COLORS[block.todoState] ?? "bg-muted text-muted-foreground"}`}
							>
								{block.todoState}
							</span>
						)}
						{block.priority != null && (
							<span
								className={`rounded px-1.5 py-0.5 font-mono font-semibold text-xs ${PRIORITY_COLORS[block.priority] ?? "bg-muted text-muted-foreground"}`}
							>
								[#{block.priority}]
							</span>
						)}
					</div>
				)}

				{/* Dates */}
				{(block.scheduled != null ||
					block.deadline != null ||
					block.closed != null) && (
					<dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
						{block.scheduled != null && (
							<>
								<dt className="text-muted-foreground">Scheduled</dt>
								<dd className="font-mono">{block.scheduled}</dd>
							</>
						)}
						{block.deadline != null && (
							<>
								<dt className="text-muted-foreground">Deadline</dt>
								<dd className="font-mono text-rose-600 dark:text-rose-400">
									{block.deadline}
								</dd>
							</>
						)}
						{block.closed != null && (
							<>
								<dt className="text-muted-foreground">Closed</dt>
								<dd className="font-mono">{block.closed}</dd>
							</>
						)}
					</dl>
				)}

				{/* Tags */}
				{block.tags.length > 0 && (
					<div className="flex flex-wrap gap-1.5">
						{block.tags.map((tag) => (
							<span
								key={tag}
								className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground text-xs"
							>
								:{tag}:
							</span>
						))}
					</div>
				)}

				{/* File path */}
				<p
					className="truncate font-mono text-[11px] text-muted-foreground"
					title={block.filePath}
				>
					{block.filePath}
				</p>

				{/* Body */}
				{block.body.length > 0 && (
					<pre className="overflow-x-auto whitespace-pre-wrap rounded bg-muted/50 p-2 font-mono text-xs leading-relaxed">
						{block.body}
					</pre>
				)}
			</div>
		</>
	);
}

export default BlockDetailsPopover;
