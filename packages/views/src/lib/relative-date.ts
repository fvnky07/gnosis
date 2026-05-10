/**
 * Render a date as a short human-readable phrase relative to `now`. Used
 * on todo cards' deadline / scheduled subtitles ("Tomorrow", "Friday",
 * "Overdue 2d"). Stays in plain ISO `YYYY-MM-DD` mode — no timezone
 * arithmetic, no Intl format hops.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_NAMES = [
	"Sunday",
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
];

export function startOfDay(date: Date): Date {
	const out = new Date(date);
	out.setHours(0, 0, 0, 0);
	return out;
}

export function dayDiff(a: Date, b: Date): number {
	return Math.round(
		(startOfDay(a).getTime() - startOfDay(b).getTime()) / DAY_MS,
	);
}

/** Render a target date relative to `now`. */
export function relativeDate(target: Date, now: Date = new Date()): string {
	const diff = dayDiff(target, now);
	if (diff === 0) return "Today";
	if (diff === 1) return "Tomorrow";
	if (diff === -1) return "Yesterday";
	if (diff > 1 && diff <= 6) return DAY_NAMES[target.getDay()] ?? "";
	if (diff < -1 && diff >= -6) return `Overdue ${-diff}d`;
	if (diff < -6) return `Overdue ${formatLongAge(-diff)}`;
	return formatShortFuture(target, diff);
}

function formatLongAge(days: number): string {
	if (days < 30) return `${days}d`;
	const months = Math.round(days / 30);
	if (months < 12) return `${months}mo`;
	const years = Math.round(months / 12);
	return `${years}y`;
}

function formatShortFuture(date: Date, days: number): string {
	if (days < 30) return `in ${days}d`;
	const yyyy = date.getFullYear();
	const mm = String(date.getMonth() + 1).padStart(2, "0");
	const dd = String(date.getDate()).padStart(2, "0");
	return `${yyyy}-${mm}-${dd}`;
}

/** Parse the date portion of an org timestamp like `<2026-05-07 Thu>`. */
export function parseOrgDate(raw: string | null | undefined): Date | null {
	if (!raw) return null;
	const m = /(\d{4}-\d{2}-\d{2})/.exec(raw);
	if (!m) return null;
	const [yearStr, monthStr, dayStr] = m[1].split("-");
	if (!yearStr || !monthStr || !dayStr) return null;
	return new Date(Number(yearStr), Number(monthStr) - 1, Number(dayStr));
}
