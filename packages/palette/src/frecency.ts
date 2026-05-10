/**
 * Raycast-style frecency: combine visit count with a recency decay. Stored
 * as a flat map and persisted to `app_state.palette_frecency` per provider
 * id (file frecency is separate from command frecency).
 *
 * Score formula: `count * decay(now - lastVisitedMs)` where the decay is a
 * 1/(1+x/half-life) sigmoid that yields ≈1 at zero age, ≈0.5 after the
 * configured half-life, and tends to 0 thereafter. Default half-life is
 * 7 days, which matches how often most note-takers revisit the same daily
 * note.
 */

export interface FrecencyEntry {
	count: number;
	lastVisitedMs: number;
}

export type FrecencyMap = Record<string, FrecencyEntry>;

export interface FrecencyOptions {
	/** Half-life of the decay function in milliseconds. */
	halfLifeMs?: number;
	/** Clock injection for tests. Defaults to `Date.now`. */
	now?(): number;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_HALF_LIFE_MS = 7 * DAY_MS;

export function decay(
	ageMs: number,
	halfLifeMs = DEFAULT_HALF_LIFE_MS,
): number {
	if (ageMs <= 0) return 1;
	return 1 / (1 + ageMs / halfLifeMs);
}

export function frecencyScore(
	entry: FrecencyEntry,
	options: FrecencyOptions = {},
): number {
	const now = options.now ? options.now() : Date.now();
	const halfLife = options.halfLifeMs ?? DEFAULT_HALF_LIFE_MS;
	return entry.count * decay(now - entry.lastVisitedMs, halfLife);
}

/**
 * Bump an entry: increment count, set lastVisitedMs to now. Returns the new
 * map (does not mutate input). Use this when the user submits a palette
 * item so the next open ranks frequently-used items higher.
 */
export function bumpFrecency(
	map: FrecencyMap,
	itemId: string,
	options: FrecencyOptions = {},
): FrecencyMap {
	const now = options.now ? options.now() : Date.now();
	const existing = map[itemId];
	return {
		...map,
		[itemId]: {
			count: (existing?.count ?? 0) + 1,
			lastVisitedMs: now,
		},
	};
}

/**
 * Sort items by frecency score, descending. Items missing from the map are
 * placed after items with any score history, in input order.
 */
export function sortByFrecency<T extends { id: string }>(
	items: T[],
	map: FrecencyMap,
	options: FrecencyOptions = {},
): T[] {
	return [...items].sort((a, b) => {
		const aEntry = map[a.id];
		const bEntry = map[b.id];
		if (aEntry && !bEntry) return -1;
		if (!aEntry && bEntry) return 1;
		if (!aEntry && !bEntry) return 0;
		// biome-ignore lint/style/noNonNullAssertion: both checked above
		return frecencyScore(bEntry!, options) - frecencyScore(aEntry!, options);
	});
}
