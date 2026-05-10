const TITLE_RE = /^#\+TITLE:\s*(.*)$/i;
const FILETAGS_RE = /^#\+FILETAGS:\s*(.*)$/i;

export interface FileKeywords {
	title?: string;
	fileTags: string[];
}

/**
 * Extract `#+TITLE:` and `#+FILETAGS:` from preamble text (everything before
 * the first heading). Other `#+...` lines are ignored — the parser preserves
 * them in the preamble's raw text but doesn't lift them into the document
 * model for MVP. File-tags are accepted in either `:tag:tag:` or whitespace-
 * separated form, both lowercased. Only the first `#+TITLE:` wins.
 */
export function parseFileKeywords(preamble: string): FileKeywords {
	const result: FileKeywords = { fileTags: [] };
	const lines = preamble.split("\n");
	for (const line of lines) {
		const titleMatch = TITLE_RE.exec(line);
		if (
			titleMatch &&
			titleMatch[1] !== undefined &&
			result.title === undefined
		) {
			result.title = titleMatch[1].trim();
			continue;
		}
		const tagsMatch = FILETAGS_RE.exec(line);
		if (tagsMatch && tagsMatch[1] !== undefined) {
			result.fileTags = parseFileTagsValue(tagsMatch[1]);
		}
	}
	return result;
}

function parseFileTagsValue(value: string): string[] {
	const trimmed = value.trim();
	if (trimmed.startsWith(":") && trimmed.endsWith(":") && trimmed.length > 1) {
		return trimmed
			.split(":")
			.filter(Boolean)
			.map((t) => t.toLowerCase());
	}
	return trimmed
		.split(/\s+/)
		.filter(Boolean)
		.map((t) => t.toLowerCase());
}
