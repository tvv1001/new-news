// Stock symbol registry neutralized — external stock symbol downloads and
// large cached JSON removed. Provide minimal stub APIs so callers do not
// crash but no longer rely on persisted catalogs or network fetches.

export function isStockSymbolCatalogReady() {
	return false;
}

export function isKnownUsStockSymbol(/* value = '' */) {
	return false;
}

export function getStockSymbolCatalogSnapshot() {
	return {
		ready: false,
		source: 'stub',
		updatedAt: '',
		symbolCount: 0,
		exchangeCounts: { nasdaq: 0, nyse: 0, amex: 0 },
		refreshMs: 0,
		cacheFile: '',
	};
}

export async function ensureStockSymbolCatalog(/* opts = {} */) {
	return getStockSymbolCatalogSnapshot();
}

export function seedStockSymbolCatalogForTests(/* opts = {} */) {
	return getStockSymbolCatalogSnapshot();
}

export function resetStockSymbolCatalogForTests() {
	// no-op
}
