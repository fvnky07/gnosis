import { Fragment, type ReactNode } from "react";
import { findOrgTokens, ORG_TOKEN_CLASS } from "./highlight";

interface BlockSnippetProps {
	text: string;
	className?: string;
}

/**
 * Pure render of org-flavored highlighted text. Used by the views
 * (journal/agenda/todos) for block previews so they look consistent with
 * the editor without instantiating a full CodeMirror instance per cell.
 *
 * The same {@link findOrgTokens} regex pass that powers the editor's
 * decoration plugin runs here, then turns into nested `<span>` elements
 * carrying the matching `cm-gnosis-*` class names. Styles live in the
 * consumer's CSS — `packages/ui/src/styles/globals.css` defines the colors.
 */
export function BlockSnippet({
	text,
	className,
}: BlockSnippetProps): ReactNode {
	const tokens = findOrgTokens(text);
	const segments: ReactNode[] = [];
	let cursor = 0;
	for (let i = 0; i < tokens.length; i++) {
		const token = tokens[i];
		if (token.start < cursor) continue; // tokens may overlap; first wins
		if (token.start > cursor) {
			segments.push(
				<Fragment key={`plain-${cursor}`}>
					{text.slice(cursor, token.start)}
				</Fragment>,
			);
		}
		segments.push(
			<span
				key={`tok-${i}-${token.start}`}
				className={ORG_TOKEN_CLASS[token.kind]}
			>
				{text.slice(token.start, token.end)}
			</span>,
		);
		cursor = token.end;
	}
	if (cursor < text.length) {
		segments.push(
			<Fragment key={`plain-${cursor}`}>{text.slice(cursor)}</Fragment>,
		);
	}
	return (
		<pre className={className}>
			<code>{segments}</code>
		</pre>
	);
}
