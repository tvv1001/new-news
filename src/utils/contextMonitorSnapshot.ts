const CONTEXT_KEYS = ['research', 'news', 'shopping'] as const;

type ContextKey = (typeof CONTEXT_KEYS)[number];

function createEmptyContexts() {
	return {
		research: [],
		news: [],
		shopping: [],
	};
}

function normalizeMatches(snapshot: any = {}) {
	if (Array.isArray(snapshot?.matches)) {
		return [...snapshot.matches];
	}
	if (Array.isArray(snapshot?.output?.matches)) {
		return [...snapshot.output.matches];
	}
	return [];
}

function hasExplicitMatches(snapshot: any = {}) {
	return Array.isArray(snapshot?.matches) || Array.isArray(snapshot?.output?.matches);
}

function normalizeContextKey(value = ''): ContextKey | '' {
	const normalizedValue = String(value || '').trim().toLowerCase();
	return (CONTEXT_KEYS as readonly string[]).includes(normalizedValue) ? (normalizedValue as ContextKey) : '';
}

function rebuildContexts(matches: any[] = [], fallbackContexts: any = {}) {
	const nextContexts = {
		...createEmptyContexts(),
		...(fallbackContexts && typeof fallbackContexts === 'object' ? fallbackContexts : {}),
	};

	for (const key of CONTEXT_KEYS) {
		nextContexts[key] = [];
	}

	for (const item of Array.isArray(matches) ? matches : []) {
		const contextKey = normalizeContextKey(item?.context);
		if (contextKey) {
			nextContexts[contextKey].push(item);
		}
	}

	return nextContexts;
}

function cloneOutput(base: any = {}, incoming: any = {}) {
	return {
		...(base && typeof base === 'object' ? base : {}),
		...(incoming && typeof incoming === 'object' ? incoming : {}),
	};
}

export function mergeContextMonitorSnapshot(base: any = null, incoming: any = null) {
	if (!incoming) {
		if (!base) return null;
		const baseMatches = normalizeMatches(base);
		return {
			...base,
			matches: baseMatches,
			contexts: rebuildContexts(baseMatches, base?.contexts),
			output: {
				...cloneOutput(base?.output),
				matches: baseMatches,
			},
		};
	}

	const baseSnapshot = base && typeof base === 'object' ? base : {};
	const incomingSnapshot = incoming && typeof incoming === 'object' ? incoming : {};
	const nextMatches =
		hasExplicitMatches(incomingSnapshot) ? normalizeMatches(incomingSnapshot)
		: hasExplicitMatches(baseSnapshot) ? normalizeMatches(baseSnapshot)
		: [];

	return {
		...baseSnapshot,
		...incomingSnapshot,
		matches: nextMatches,
		contexts: rebuildContexts(nextMatches, incomingSnapshot?.contexts || baseSnapshot?.contexts),
		output: {
			...cloneOutput(baseSnapshot?.output, incomingSnapshot?.output),
			matches: nextMatches,
		},
	};
}

export function applyContextMonitorDiff(base: any = null, diff: any = {}) {
	const normalizedBase = mergeContextMonitorSnapshot(base, base) || {
		contexts: createEmptyContexts(),
		matches: [],
		output: { matches: [] },
	};
	const baseMatches = normalizeMatches(normalizedBase);
	const updatedById = new Map<string, any>(
		(diff?.updated || [])
			.filter((item: any) => item?.id)
			.map((item: any) => [String(item.id), item]),
	);
	const addedById = new Map<string, any>(
		(diff?.added || [])
			.filter((item: any) => item?.id)
			.map((item: any) => [String(item.id), item]),
	);
	const removedIds = new Set<string>((diff?.removed || []).map((id: any) => String(id)));
	const nextMatches: any[] = [];
	const seenIds = new Set<string>();

	for (const item of baseMatches) {
		const itemId = item?.id ? String(item.id) : '';
		if (!itemId) {
			nextMatches.push(item);
			continue;
		}
		if (removedIds.has(itemId)) {
			continue;
		}
		if (updatedById.has(itemId)) {
			nextMatches.push(updatedById.get(itemId));
			seenIds.add(itemId);
			continue;
		}
		nextMatches.push(item);
		seenIds.add(itemId);
	}

	for (const [itemId, item] of updatedById.entries()) {
		if (!seenIds.has(itemId) && !removedIds.has(itemId)) {
			nextMatches.push(item);
			seenIds.add(itemId);
		}
	}

	for (const [itemId, item] of addedById.entries()) {
		if (!seenIds.has(itemId) && !removedIds.has(itemId)) {
			nextMatches.push(item);
			seenIds.add(itemId);
		}
	}

	return {
		...normalizedBase,
		matches: nextMatches,
		contexts: rebuildContexts(nextMatches, normalizedBase?.contexts),
		output: {
			...cloneOutput(normalizedBase?.output),
			matches: nextMatches,
		},
	};
}
