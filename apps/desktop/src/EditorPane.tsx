import { type BufferProps, createEditor } from "@gnosis/editor";
import { useEffect, useRef } from "react";

interface EditorPaneProps extends BufferProps {
	className?: string;
}

/**
 * React wrapper that mounts a CodeMirror editor (with vim mode by default)
 * inside a host `<div>`. The wrapper re-creates the underlying EditorView
 * whenever `bufferId` changes — switching files is a full remount, which is
 * cheaper than reconfiguring an existing instance and matches what the
 * `bufferStore` expects per `planning/07-state-and-stores.md`.
 */
export function EditorPane({ className, ...props }: EditorPaneProps) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const propsRef = useRef(props);
	propsRef.current = props;

	useEffect(() => {
		const host = containerRef.current;
		if (!host) return;
		const view = createEditor(host, propsRef.current);
		return () => {
			view.destroy();
		};
	}, [props.bufferId]);

	return <div ref={containerRef} className={className} />;
}
