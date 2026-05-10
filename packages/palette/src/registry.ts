import type {
	PaletteCtx,
	PaletteItem,
	PaletteMode,
	PaletteProvider,
} from "./types";

/**
 * In-memory registry of providers. Mounted at the application root so
 * providers register exactly once. Per-mode scoping is enforced by the
 * `match()` and `scope` fields on each provider; the registry itself is
 * just a flat list with cheap accessors.
 *
 * The registry is mutable. Tests construct one per case. The desktop
 * runtime constructs one at boot and threads it through React context.
 */
export class PaletteRegistry {
	private providers: PaletteProvider[] = [];

	register(provider: PaletteProvider): void {
		const exists = this.providers.findIndex((p) => p.id === provider.id);
		if (exists >= 0) {
			this.providers[exists] = provider;
			return;
		}
		this.providers.push(provider);
		this.providers.sort((a, b) => a.rank - b.rank);
	}

	unregister(providerId: string): void {
		this.providers = this.providers.filter((p) => p.id !== providerId);
	}

	get(providerId: string): PaletteProvider | undefined {
		return this.providers.find((p) => p.id === providerId);
	}

	all(): readonly PaletteProvider[] {
		return this.providers;
	}

	/**
	 * Filter providers eligible for a given mode. A provider participates
	 * when its `scope` either includes the mode or is the literal mode
	 * (single-mode shortcut).
	 */
	forMode(mode: PaletteMode): PaletteProvider[] {
		return this.providers.filter((p) => providerInScope(p, mode));
	}

	/**
	 * Resolve the first provider whose `trigger` matches the start of the
	 * query. Longest-prefix-wins so `tpl ` resolves before `t `.
	 */
	resolveByTrigger(query: string): PaletteProvider | undefined {
		const candidates = this.providers
			.filter(
				(p): p is PaletteProvider & { trigger: string } =>
					typeof p.trigger === "string",
			)
			.sort((a, b) => b.trigger.length - a.trigger.length);
		return candidates.find((p) => query.startsWith(p.trigger));
	}
}

function providerInScope(p: PaletteProvider, mode: PaletteMode): boolean {
	if (Array.isArray(p.scope)) return p.scope.includes(mode);
	return p.scope === mode;
}

/**
 * Run a query against every applicable provider in `mode` and merge their
 * results. Aborts in-flight async loaders via the supplied signal so a fast
 * typist doesn't queue stale results.
 */
export async function queryProviders(
	registry: PaletteRegistry,
	mode: PaletteMode,
	query: string,
	signal: AbortSignal,
	ctx: PaletteCtx,
): Promise<{ provider: PaletteProvider; items: PaletteItem[] }[]> {
	const candidates = registry.forMode(mode).filter((p) => p.match(query, ctx));
	const results = await Promise.all(
		candidates.map(async (provider) => {
			const items = await provider
				.results(query, signal, ctx)
				.catch(() => [] as PaletteItem[]);
			return { provider, items };
		}),
	);
	return results;
}
