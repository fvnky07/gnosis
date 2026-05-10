import type { ViewBlock } from "../types";
import { startOfDay } from "./relative-date";

export interface JournalGroup {
	/** Local date floored to midnight, used as the section key. */
	dayMs: number;
	dayLabel: string;
	blocks: ViewBlock[];
}

const SECTION_LABEL_OPTIONS: Intl.DateTimeFormatOptions = {
	weekday: "long",
	month: "long",
	day: "numeric",
};

/**
 * Group blocks by local-day for the journal feed's sticky-header layout.
 * Blocks without `createdMs` fall into a synthetic "Older" bucket at the
 * end of the list.
 */
export function groupJournalBlocksByDay(
	blocks: ViewBlock[],
	now: Date = new Date(),
): JournalGroup[] {
	const buckets = new Map<number, ViewBlock[]>();
	const undated: ViewBlock[] = [];

	for (const block of blocks) {
		if (block.createdMs === undefined) {
			undated.push(block);
			continue;
		}
		const day = startOfDay(new Date(block.createdMs)).getTime();
		const bucket = buckets.get(day);
		if (bucket) bucket.push(block);
		else buckets.set(day, [block]);
	}

	const sortedKeys = [...buckets.keys()].sort((a, b) => b - a);
	const today = startOfDay(now).getTime();
	const yesterday = today - 24 * 60 * 60 * 1000;

	const groups: JournalGroup[] = sortedKeys.map((dayMs) => ({
		dayMs,
		dayLabel:
			dayMs === today
				? "Today"
				: dayMs === yesterday
					? "Yesterday"
					: new Date(dayMs).toLocaleDateString(
							undefined,
							SECTION_LABEL_OPTIONS,
						),
		blocks: (buckets.get(dayMs) ?? []).sort(
			(a, b) => (b.createdMs ?? 0) - (a.createdMs ?? 0),
		),
	}));

	if (undated.length > 0) {
		groups.push({ dayMs: 0, dayLabel: "Older", blocks: undated });
	}

	return groups;
}

/** Filter only journal-tagged blocks. Used as a pre-filter when a single
 * `blocks[]` collection is rendered into multiple views. */
export function filterJournalBlocks(blocks: ViewBlock[]): ViewBlock[] {
	return blocks.filter((b) => b.tags.includes("journal"));
}
