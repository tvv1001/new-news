import { applyContextMonitorDiff, mergeContextMonitorSnapshot } from './utils/contextMonitorSnapshot';

/**
 * api.js – thin client for the person-search server
 */

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const CONTEXT_BASE = process.env.NEXT_PUBLIC_CONTEXT_API_URL || BASE;

function buildApiUrl(pathname: string, base = BASE) {
	return new URL(pathname, base).toString();
}

async function handleResponse(res: Response) {
	let data: any;
	try {
		data = await res.json();
	} catch (err) {
		const text = await res.text().catch(() => '');
		const error: any = new Error(`Failed to parse response as JSON. Status: ${res.status}. Body: ${text.slice(0, 100)}...`);
		error.status = res.status;
		throw error;
	}

	if (!res.ok) {
		const error: any = new Error(data.error || `HTTP ${res.status}`);
		error.status = res.status;
		error.payload = data;
		throw error;
	}
	return data;
}

export async function fetchContextMonitor({ refresh = false } = {}) {
	const url = new URL(buildApiUrl('/api/context/monitor', CONTEXT_BASE));
	if (refresh) {
		url.searchParams.set('refresh', '1');
	}
	try {
		const res = await fetch(url as any, { cache: 'no-store' });
		return await handleResponse(res);
	} catch (err) {
		// Return a safe default so callers don't crash when the backend is unavailable.
		return {
			status: { started: false },
			config: {},
			tags: [],
			sources: { builtin: [] },
			catalog: [],
			output: { matches: [] },
		};
	}
}

export async function fetchContextPortal() {
	const url = new URL(buildApiUrl('/api/context/portal', CONTEXT_BASE));
	try {
		const res = await fetch(url as any, { cache: 'no-store' });
		return await handleResponse(res);
	} catch (err) {
		// Return a safe default shape so the UI can render while the backend
		// is unavailable or the request fails.
		return {
			status: { started: false },
			config: {},
			tags: [],
			sources: { builtin: [] },
			catalog: [],
			output: { matches: [] },
		};
	}
}

export function openContextMonitorStream({ onSnapshot, onOpen, onError }: any = {}) {
	if (typeof EventSource === 'undefined') {
		return null;
	}

	const stream = new EventSource(buildApiUrl('/api/context/stream', CONTEXT_BASE));
	let latestSnapshot: any = null;

	const handleSnapshot = (event: any) => {
		try {
			const payload = JSON.parse(event.data);
			latestSnapshot = mergeContextMonitorSnapshot(latestSnapshot, payload?.snapshot || payload);
			onSnapshot?.({
				...payload,
				snapshot: latestSnapshot,
			});
		} catch (error) {
			onError?.(error);
		}
	};

	const handleDiff = (event: any) => {
		try {
			const payload = JSON.parse(event.data);
			latestSnapshot = applyContextMonitorDiff(latestSnapshot, payload?.diff || {});
			onSnapshot?.({
				...payload,
				snapshot: latestSnapshot,
			});
		} catch (error) {
			onError?.(error);
		}
	};

	stream.addEventListener('snapshot', handleSnapshot);
	stream.addEventListener('diff', handleDiff);
	stream.onopen = () => onOpen?.();
	stream.onerror = (error: any) => onError?.(error);

	return stream;
}

export async function addContextTags(tags: any = []) {
	const payload = Array.isArray(tags) ? tags : [tags];
	const res = await fetch(buildApiUrl('/api/context/tags', CONTEXT_BASE), {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ tags: payload }),
	});
	return handleResponse(res);
}

export async function replaceContextTags(tags: any = []) {
	const payload = Array.isArray(tags) ? tags : [tags];
	const res = await fetch(buildApiUrl('/api/context/tags', CONTEXT_BASE), {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ tags: payload }),
	});
	return handleResponse(res);
}

export async function removeContextTags(tags: any = []) {
	const payload = Array.isArray(tags) ? tags : [tags];
	const res = await fetch(buildApiUrl('/api/context/tags', CONTEXT_BASE), {
		method: 'DELETE',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ tags: payload }),
	});
	return handleResponse(res);
}

export async function addContextSource(source: any) {
	const url = buildApiUrl('/api/context/sources', CONTEXT_BASE);
	const res = await fetch(url as any, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(source),
	});
	return handleResponse(res);
}

export async function removeContextSource(sourceUrl: string) {
	const url = buildApiUrl('/api/context/sources', CONTEXT_BASE);
	const res = await fetch(url as any, {
		method: 'DELETE',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ url: sourceUrl }),
	});
	return handleResponse(res);
}

export async function updateContextSource(oldUrl: string, source: any) {
	const url = buildApiUrl('/api/context/sources', CONTEXT_BASE);
	const res = await fetch(url as any, {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ oldUrl, ...source }),
	});
	return handleResponse(res);
}

export async function testContextSource(sourceInput: any) {
	const payload = typeof sourceInput === 'string' ? { url: sourceInput } : sourceInput || {};
	const url = buildApiUrl('/api/context/sources/test', CONTEXT_BASE);
	const res = await fetch(url as any, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
	});
	return handleResponse(res);
}

export async function blockContextSource(sourceUrl: string) {
	const url = buildApiUrl('/api/context/sources/block', CONTEXT_BASE);
	const res = await fetch(url as any, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ url: sourceUrl }),
	});
	return handleResponse(res);
}

export async function unblockContextSource(sourceUrl: string) {
	const url = buildApiUrl('/api/context/sources/block', CONTEXT_BASE);
	const res = await fetch(url as any, {
		method: 'DELETE',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ url: sourceUrl }),
	});
	return handleResponse(res);
}
