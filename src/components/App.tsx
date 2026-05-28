'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { addContextTags, fetchContextMonitor, replaceContextTags } from '../api';
import ContextFeedColumn from './ContextFeedColumn';
import { normalizeContextTagForSync } from './contextFeedTagUtils';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const CONTEXT_BASE = process.env.NEXT_PUBLIC_CONTEXT_API_URL || API_BASE;
const CONTEXT_RETRY_MS = 15000;
const CONTEXT_OFFLINE_MESSAGE = 'Context feed service is offline. Start the feed service to enable live tags and live updates.';
const ACTIVE_CONTEXT_TAG_STORAGE_KEY = 'query-notify.active-context-tag';

function createContextMonitorState() {
	return {
		started: false,
		streamVersion: 0,
		tags: [] as any[],
		keywords: [] as any[],
		matches: [] as any[],
		contexts: { research: [] as any[], news: [] as any[], shopping: [] as any[] },
		lastUpdatedAt: '',
		lastError: '',
		progressiveFeedState: {
			active: false,
			phase: 'complete',
			matchesLoadedCount: 0,
			matchesTotal: 0,
		},
	};
}

function useContextMonitor({ enabled = true } = {}) {
	const [monitor, setMonitor] = useState(createContextMonitorState);
	const workerRef = useRef<Worker | null>(null);

	useEffect(() => {
		if (!enabled) {
			setMonitor(createContextMonitorState());
			return undefined;
		}

		if (typeof Worker === 'undefined') {
			setMonitor((current: any) => ({
				...current,
				lastError: CONTEXT_OFFLINE_MESSAGE,
			}));
			return undefined;
		}

		const worker = new Worker(new URL('../workers/contextMonitorWorker.ts', import.meta.url));
		workerRef.current = worker;

		worker.addEventListener('message', (event) => {
			const { type, status, snapshot, error } = event.data || {};

			if (type === 'status') {
				if (status === 'offline') {
					setMonitor((current: any) => ({
						...current,
						lastError: current.lastError || CONTEXT_OFFLINE_MESSAGE,
					}));
				}
				return;
			}

			if (type === 'snapshot') {
				setMonitor((current: any) => ({
					...current,
					...(snapshot || {}),
					lastError: snapshot?.lastError || '',
				}));
				return;
			}

			if (type === 'worker-error') {
				setMonitor((current: any) => ({
					...current,
					lastError: error || current.lastError || CONTEXT_OFFLINE_MESSAGE,
				}));
			}

			if (type === 'card-added' || type === 'card-updated' || type === 'card-removed') {
				if (typeof window !== 'undefined' && typeof CustomEvent === 'function') {
					window.dispatchEvent(new CustomEvent(`context:${type}`, { detail: event.data }));
				}
			}
		});

		worker.postMessage({
			type: 'init',
			payload: {
				contextBase: CONTEXT_BASE,
				retryMs: CONTEXT_RETRY_MS,
			},
		});

		return () => {
			worker.postMessage({ type: 'stop' });
			worker.terminate();
			if (workerRef.current === worker) {
				workerRef.current = null;
			}
		};
	}, [enabled]);

	return monitor;
}

function getStoredString(key: string, fallback = '') {
	if (typeof window === 'undefined') return fallback;
	return window.localStorage.getItem(key) || fallback;
}

function normalizeTagList(tags: any[] = []) {
	return [...new Set((Array.isArray(tags) ? tags : []).map((tag) => normalizeContextTagForSync(tag)).filter(Boolean))].sort((left: any, right: any) => left.localeCompare(right));
}

function haveContextTagsChanged(left: any[] = [], right: any[] = []) {
	const normalizedLeft = normalizeTagList(left);
	const normalizedRight = normalizeTagList(right);
	if (normalizedLeft.length !== normalizedRight.length) return true;

	return normalizedLeft.some((tag, index) => tag !== normalizedRight[index]);
}

function hasLiveLaneSnapshotReady(monitor: any = {}) {
	if (!monitor || typeof monitor !== 'object') return false;
	if (monitor.lastError) return true;
	if (monitor.lastUpdatedAt) return true;
	if (Array.isArray(monitor.matches) && monitor.matches.length > 0) return true;
	if (Array.isArray(monitor.contexts?.news) && monitor.contexts.news.length > 0) return true;
	return false;
}

function App() {
	const [hasLoadedPersistedContextState, setHasLoadedPersistedContextState] = useState(false);
	const [activeContextTag, setActiveContextTag] = useState('');
	const [hasInitializedContextSelections, setHasInitializedContextSelections] = useState(false);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const contextSyncSignatureRef = useRef('');
	const contextSyncInFlightRef = useRef('');
	const contextSyncRetryAtRef = useRef(0);
	const contextSyncTimerRef = useRef<number | null>(null);
	const sharedContextMonitor = useContextMonitor({ enabled: true });
	const contextKeywords =
		(sharedContextMonitor?.tags?.length ? sharedContextMonitor.tags : null) || (sharedContextMonitor?.keywords?.length ? sharedContextMonitor.keywords : null) || [];

	useEffect(() => {
		setActiveContextTag(getStoredString(ACTIVE_CONTEXT_TAG_STORAGE_KEY));
		setHasLoadedPersistedContextState(true);
	}, []);

	useEffect(() => {
		if (!hasLoadedPersistedContextState || hasInitializedContextSelections) {
			return;
		}

		const monitorTags = normalizeTagList(Array.isArray(contextKeywords) ? contextKeywords : []);
		if (activeContextTag) {
			setHasInitializedContextSelections(true);
			return;
		}

		if (monitorTags.length > 0) {
			setActiveContextTag(monitorTags[0]);
			return;
		}

		if (sharedContextMonitor?.started) {
			setHasInitializedContextSelections(true);
		}
	}, [activeContextTag, contextKeywords, hasInitializedContextSelections, hasLoadedPersistedContextState, sharedContextMonitor?.started]);

	useEffect(() => {
		if (!hasLoadedPersistedContextState || !hasInitializedContextSelections) return;
		if (!sharedContextMonitor?.started) return;

		const desiredTags = normalizeTagList([activeContextTag]);
		const observedTags = normalizeTagList(contextKeywords);
		const syncSignature = JSON.stringify({ desiredTags, observedTags });
		const now = Date.now();
		const debounceMs = 350;

		if (contextSyncTimerRef.current) {
			window.clearTimeout(contextSyncTimerRef.current);
			contextSyncTimerRef.current = null;
		}

		if (contextSyncRetryAtRef.current > now) {
			return;
		}

		if (contextSyncInFlightRef.current === syncSignature) {
			return;
		}

		if (!haveContextTagsChanged(desiredTags, observedTags) && contextSyncSignatureRef.current === syncSignature) {
			return;
		}
		let cancelled = false;

		const syncContextTags = async () => {
			contextSyncInFlightRef.current = syncSignature;
			try {
				await replaceContextTags(desiredTags);
				if (cancelled) return;
				contextSyncSignatureRef.current = JSON.stringify({ desiredTags, observedTags: desiredTags });
				contextSyncRetryAtRef.current = 0;
			} catch (syncError: any) {
				if (cancelled) return;
				if (syncError?.status === 429) {
					contextSyncRetryAtRef.current = Date.now() + 5000;
					return;
				}
				console.error('Unable to sync context tags.', syncError);
			} finally {
				if (contextSyncInFlightRef.current === syncSignature) {
					contextSyncInFlightRef.current = '';
				}
			}
		};

		contextSyncTimerRef.current = window.setTimeout(() => {
			void syncContextTags();
		}, debounceMs);

		return () => {
			cancelled = true;
			if (contextSyncTimerRef.current) {
				window.clearTimeout(contextSyncTimerRef.current);
				contextSyncTimerRef.current = null;
			}
		};
	}, [activeContextTag, hasInitializedContextSelections, hasLoadedPersistedContextState, contextKeywords, sharedContextMonitor?.started]);

	useEffect(() => {
		if (!hasLoadedPersistedContextState || typeof window === 'undefined') return;
		if (!activeContextTag) {
			window.localStorage.removeItem(ACTIVE_CONTEXT_TAG_STORAGE_KEY);
			return;
		}

		window.localStorage.setItem(ACTIVE_CONTEXT_TAG_STORAGE_KEY, activeContextTag);
	}, [activeContextTag, hasLoadedPersistedContextState]);

	const handleAddTag = async (tag: string) => {
		const normalizedTag = normalizeContextTagForSync(tag);
		if (!normalizedTag) return;
		await addContextTags([normalizedTag]);
		setActiveContextTag(normalizedTag);
	};

	const handleClearPrimaryContextTag = () => {
		setActiveContextTag('');
	};

	const handleRefresh = async () => {
		if (isRefreshing) return;
		setIsRefreshing(true);
		await fetchContextMonitor({ refresh: true }).catch(() => {});
		setIsRefreshing(false);
	};

	const hasInitializedLiveLanes = hasLiveLaneSnapshotReady(sharedContextMonitor);
	const normalizedTags = useMemo(() => normalizeTagList(contextKeywords), [contextKeywords]);

	return (
		<div className='app-shell'>
			<nav className='app-nav'>
				<span className='app-nav-brand'>Tag Feed</span>
				<div style={{ marginLeft: 'auto', display: 'flex', gap: '12px' }}>
					<a
						href='/news-deck'
						className='app-nav-link'
						target='_blank'
						rel='noopener noreferrer'>
						News Deck
					</a>
					<a
						href='/pipeline'
						className='app-nav-link'
						target='_blank'
						rel='noopener noreferrer'>
						Pipeline
					</a>
					<a
						href='/sse-dashboard'
						className='app-nav-link'
						target='_blank'
						rel='noopener noreferrer'>
						SSE Dashboard
					</a>
				</div>
			</nav>

			{(sharedContextMonitor.lastError || sharedContextMonitor.lastUpdatedAt) && (
				<div className={`context-banner ${sharedContextMonitor.lastError ? 'context-banner-error' : 'context-banner-info'}`}>
					<span className='context-banner-message'>
						{sharedContextMonitor.lastError ?
							`Feed warning: ${sharedContextMonitor.lastError}`
						:	`Feeds active • Last updated ${new Date(sharedContextMonitor.lastUpdatedAt).toLocaleTimeString()}`}
					</span>
				</div>
			)}

			<header className='news-deck-header'>
				<div>
					<h1>Tag Lane</h1>
					<p className='news-deck-subtitle'>The home route now runs tag-lane-only. Live matches stream here without the old background search panels.</p>
				</div>
				<div className='news-deck-header-actions'>
					<button
						className='btn btn-secondary'
						type='button'
						onClick={handleRefresh}
						disabled={isRefreshing || !hasInitializedLiveLanes}>
						{isRefreshing ? 'Refreshing…' : 'Refresh Now'}
					</button>
					<span className={`status-pill ${sharedContextMonitor.lastError ? 'status-offline' : 'status-online'}`}>
						{sharedContextMonitor.lastError ? 'Feed Warning' : 'Live Feed Ready'}
					</span>
				</div>
			</header>

			<section className='news-deck-status'>
				<div>
					<strong>Status:</strong> {sharedContextMonitor?.lastUpdatedAt ? new Date(sharedContextMonitor.lastUpdatedAt).toLocaleTimeString() : 'Awaiting first refresh'}
				</div>
				<div>
					<strong>Stream version:</strong> {sharedContextMonitor?.streamVersion ?? 'N/A'}
				</div>
				<div>
					<strong>Tags:</strong> {normalizedTags.length ? normalizedTags.join(', ') : <span className='news-deck-empty'>No active tags yet.</span>}
				</div>
			</section>

			<section className='news-deck-columns'>
				<ContextFeedColumn
					columnKey='primary'
					monitor={sharedContextMonitor}
					activeTag={activeContextTag}
					contextFilter='all'
					columnTitle='Tag Lane'
					showComposer={true}
					allowActiveTagClear={true}
					onClearActiveTag={handleClearPrimaryContextTag}
					onSelectTag={setActiveContextTag}
					onAddTag={handleAddTag}
				/>
			</section>
		</div>
	);
}

export default App;
