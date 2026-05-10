import { useCallback, useEffect, useRef } from "react";

interface ResizeHandleProps {
	/** Current right-pane width in px. Mirrors `--right` CSS var. */
	width: number;
	/** Called as the user drags. Host clamps + persists. */
	onWidthChange(next: number): void;
	/** Toggle expand/collapse on double-click. */
	onDoubleClick?(): void;
	min?: number;
	max?: number;
}

/**
 * Vertical 6 px hit-area drag handle for the right sidebar resize per
 * `planning/11-layout-and-shell.md`. Stores the new width in the parent
 * via `onWidthChange`; the parent debounces persistence to `app_state`.
 */
export function ResizeHandle({
	width,
	onWidthChange,
	onDoubleClick,
	min = 240,
	max = 720,
}: ResizeHandleProps) {
	const draggingRef = useRef(false);
	const startXRef = useRef(0);
	const startWidthRef = useRef(width);

	const handlePointerMove = useCallback(
		(event: PointerEvent) => {
			if (!draggingRef.current) return;
			const delta = startXRef.current - event.clientX;
			const next = Math.min(max, Math.max(min, startWidthRef.current + delta));
			onWidthChange(next);
		},
		[max, min, onWidthChange],
	);

	const handlePointerUp = useCallback(() => {
		if (!draggingRef.current) return;
		draggingRef.current = false;
		document.body.style.cursor = "";
		document.body.style.userSelect = "";
	}, []);

	useEffect(() => {
		window.addEventListener("pointermove", handlePointerMove);
		window.addEventListener("pointerup", handlePointerUp);
		return () => {
			window.removeEventListener("pointermove", handlePointerMove);
			window.removeEventListener("pointerup", handlePointerUp);
		};
	}, [handlePointerMove, handlePointerUp]);

	return (
		// biome-ignore lint/a11y/useSemanticElements: <hr> is a void element and can't host the pointer/keyboard handlers + child hit-area span the resize bar needs; <div role="separator"> matches the cmdk + react-resizable-panels conventions.
		<div
			role="separator"
			aria-orientation="vertical"
			aria-valuenow={width}
			aria-valuemin={min}
			aria-valuemax={max}
			tabIndex={0}
			onPointerDown={(event) => {
				event.preventDefault();
				draggingRef.current = true;
				startXRef.current = event.clientX;
				startWidthRef.current = width;
				document.body.style.cursor = "col-resize";
				document.body.style.userSelect = "none";
			}}
			onDoubleClick={onDoubleClick}
			className="group relative flex w-1.5 shrink-0 cursor-col-resize items-stretch bg-border hover:bg-accent"
		>
			<span className="absolute -inset-x-1 inset-y-0" />
		</div>
	);
}
