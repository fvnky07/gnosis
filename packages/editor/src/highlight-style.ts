import { HighlightStyle } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

/**
 * Tag-driven styling for the live-preview ViewPlugin. Maps Lezer markdown
 * tags onto CSS classes defined in `apps/desktop/src/styles.css` so the
 * theme can override per-mode (light/dark) without touching this file.
 *
 * Heading sizes/weights are *visual* only — the underlying doc remains raw
 * markdown. The hide-on-blur reveal-on-focus behavior is handled by the
 * companion `livePreviewPlugin`, not here.
 */
export const livePreviewHighlightStyle = HighlightStyle.define([
	{ tag: t.heading1, class: "cm-md-h1" },
	{ tag: t.heading2, class: "cm-md-h2" },
	{ tag: t.heading3, class: "cm-md-h3" },
	{ tag: t.heading4, class: "cm-md-h4" },
	{ tag: t.heading5, class: "cm-md-h5" },
	{ tag: t.heading6, class: "cm-md-h6" },
	{ tag: t.emphasis, fontStyle: "italic" },
	{ tag: t.strong, fontWeight: "700" },
	{ tag: t.strikethrough, textDecoration: "line-through" },
	{ tag: t.link, class: "cm-md-link" },
	{ tag: t.url, class: "cm-md-url" },
	{ tag: t.monospace, class: "cm-md-inline-code" },
	{ tag: t.quote, class: "cm-md-quote" },
	{ tag: t.list, class: "cm-md-list" },
	{ tag: t.meta, class: "cm-md-meta" },
]);
