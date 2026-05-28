export function normalizeContextTagValue(value = '') {
	return String(value || '')
		.trim()
		.toLowerCase();
}

export function normalizeContextTagForSync(value = '') {
	return normalizeContextTagValue(value);
}
