import type {
	EditorOptions,
	VimHostBindings,
	VimMode,
	VimOptions,
} from "@gnosis/editor";
import { type BufferProps, createEditor } from "@gnosis/editor";
import { useEffect, useMemo, useRef } from "react";

interface EditorPaneProps extends BufferProps {
	className?: string;
	style?: import("react").CSSProperties;
	vimHostBindings?: VimHostBindings;
	onVimModeChange?: (mode: VimMode) => void;
}

/**
 * React wrapper that mounts a CodeMirror editor (with vim mode by default)
 * inside a host `<div>`. The wrapper re-creates the underlying EditorView
 * whenever `bufferId` or the editor-options fingerprint changes — switching
 * files or toggling editor settings is a full remount, which is cheaper
 * than reconfiguring an existing instance and matches what the
 * `bufferStore` expects per `planning/07-state-and-stores.md`.
 */
export function EditorPane({ className, style, ...props }: EditorPaneProps) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const propsRef = useRef(props);
	propsRef.current = props;

	const optsHash = useMemo(
		() => hashEditorOpts(props.editorOpts),
		[props.editorOpts],
	);
	const vimHash = useMemo(() => hashVimOpts(props.vimOpts), [props.vimOpts]);
	const vimToken = props.vimEnabled === false ? "0" : "1";
	const remountKey = `${props.bufferId}::${vimToken}::${optsHash}::${vimHash}`;

	// biome-ignore lint/correctness/useExhaustiveDependencies: remountKey is the intentional remount key; latest props read via propsRef
	useEffect(() => {
		const host = containerRef.current;
		if (!host) return;
		const view = createEditor(host, propsRef.current);
		return () => {
			view.destroy();
		};
	}, [remountKey]);

	return <div ref={containerRef} className={className} style={style} />;
}

/** Compact fingerprint over the editor-options object. Two equal-by-value
 *  options objects produce the same string so React's remount key compares
 *  cheaply. JSON.stringify is fine here: the option set is small and the
 *  property order is stable (TypeScript's interface guarantees insertion
 *  order through the spread in callers). */
function hashEditorOpts(opts: EditorOptions | undefined): string {
	if (!opts) return "default";
	return JSON.stringify(opts);
}

function hashVimOpts(opts: VimOptions | undefined): string {
	if (!opts) return "default";
	return JSON.stringify(opts);
}
