import type { ParseWarning } from "./types";

const DRAWER_BEGIN = ":PROPERTIES:";
const DRAWER_END = ":END:";
const PROPERTY_LINE_RE = /^\s*:([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/;

export interface PropertiesParseResult {
	/** Drawer key/value map. Empty if drawer absent. */
	properties: Record<string, string>;
	/** Byte offset of `:PROPERTIES:` start (relative to input). -1 if absent. */
	drawerStart: number;
	/** Byte offset just AFTER the `:END:\n` line. -1 if absent. */
	drawerEnd: number;
	warnings: ParseWarning[];
}

/**
 * Parse a `:PROPERTIES:` drawer at the start of `text`, allowing leading
 * blank lines. If a non-blank, non-`:PROPERTIES:` line precedes the drawer,
 * returns absent (drawerStart === -1).
 *
 * MVP accepts single-line property values only; multi-line continuation
 * (which the org spec permits) is not modeled. The `unterminated-properties-
 * drawer` warning fires when the drawer never sees a `:END:` marker.
 */
export function parsePropertiesDrawer(text: string): PropertiesParseResult {
	const properties: Record<string, string> = {};
	const warnings: ParseWarning[] = [];

	let cursor = 0;
	while (cursor < text.length) {
		const lineEnd = text.indexOf("\n", cursor);
		const line =
			lineEnd === -1 ? text.slice(cursor) : text.slice(cursor, lineEnd);
		if (line.trim() === DRAWER_BEGIN) break;
		if (line.trim() !== "") {
			return { properties, drawerStart: -1, drawerEnd: -1, warnings };
		}
		if (lineEnd === -1) {
			return { properties, drawerStart: -1, drawerEnd: -1, warnings };
		}
		cursor = lineEnd + 1;
	}

	if (cursor >= text.length) {
		return { properties, drawerStart: -1, drawerEnd: -1, warnings };
	}

	const drawerStart = cursor;
	const beginLineEnd = text.indexOf("\n", cursor);
	if (beginLineEnd === -1) {
		warnings.push({
			severity: "warn",
			code: "unterminated-properties-drawer",
			message: ":PROPERTIES: drawer has no :END: marker",
			range: { start: drawerStart, end: text.length },
		});
		return {
			properties,
			drawerStart,
			drawerEnd: text.length,
			warnings,
		};
	}
	cursor = beginLineEnd + 1;

	while (cursor < text.length) {
		const nextEnd = text.indexOf("\n", cursor);
		const lineText =
			nextEnd === -1 ? text.slice(cursor) : text.slice(cursor, nextEnd);
		if (lineText.trim() === DRAWER_END) {
			const drawerEnd = nextEnd === -1 ? text.length : nextEnd + 1;
			return { properties, drawerStart, drawerEnd, warnings };
		}
		const propMatch = PROPERTY_LINE_RE.exec(lineText);
		if (propMatch) {
			const [, key, value] = propMatch;
			if (key !== undefined && value !== undefined) {
				properties[key] = value.trimEnd();
			}
		}
		if (nextEnd === -1) break;
		cursor = nextEnd + 1;
	}

	warnings.push({
		severity: "warn",
		code: "unterminated-properties-drawer",
		message: ":PROPERTIES: drawer has no :END: marker",
		range: { start: drawerStart, end: text.length },
	});
	return { properties, drawerStart, drawerEnd: text.length, warnings };
}
