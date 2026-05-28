'use client';

import { useEffect, useMemo, useState } from 'react';
import { addContextTags, fetchContextMonitor, openContextMonitorStream } from '../../api';
import ContextFeedColumn from '../../components/ContextFeedColumn';
import { normalizeContextTagForSync } from '../../components/contextFeedTagUtils';
import '../../style.css';

function formatRelativeTime(isoDate = '') {
	if (!isoDate) {
		return 'Awaiting first refresh';
	}

	const date = new Date(isoDate);
	if (Number.isNaN(date.getTime())) {
		return 'Awaiting first refresh';
	}

	const diffMs = Date.now() - date.getTime();
	const diffMinutes = Math.max(0, Math.round(diffMs / 60_000));

	if (diffMinutes < 1) {
		return 'Updated just now';
	}

	if (diffMinutes === 1) {
		return 'Updated 1 minute ago';
	}

	if (diffMinutes < 60) {
		return `Updated ${diffMinutes} minutes ago`;
	}

	const diffHours = Math.round(diffMinutes / 60);
	return `Updated ${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
}

function normalizeTagValue(tag = '') {
	return normalizeContextTagForSync(String(tag || ''));
}

export default function NewsDeckPage() {
	const [monitor, setMonitor] = useState<any>(null);
	const [selectedTag, setSelectedTag] = useState('');
	const [isConnected, setIsConnected] = useState(false);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [error, setError] = useState('');

	const activeTag = useMemo(() => {
		if (selectedTag) {
			return normalizeTagValue(selectedTag);
		}
		if (Array.isArray(monitor?.tags) && monitor.tags.length > 0) {
			return normalizeTagValue(monitor.tags[0]);
		}
		return '';
	}, [monitor?.tags, selectedTag]);

	const tagOptions = useMemo(() => {
		return Array.isArray(monitor?.tags) ? monitor.tags.map(normalizeTagValue).filter(Boolean) : [];
	}, [monitor?.tags]);

	const loadMonitor = async ({ refresh = false, isMounted = true } = {}) => {
		setError('');
		try {
			const snapshot = await fetchContextMonitor({ refresh });
			if (isMounted) {
				setMonitor(snapshot);
			}
		} catch (err: any) {
			if (isMounted) {
				setError(err?.message || 'Unable to load live feed snapshot.');
			}
		}
	};

	useEffect(() => {
		let isMounted = true;

		const bootstrap = async () => {
			await loadMonitor({ refresh: false, isMounted });
			if (!isMounted) return;

			const stream = openContextMonitorStream({
				onSnapshot: (payload: any) => {
					if (!payload || !payload.snapshot) return;
					setMonitor(payload.snapshot);
					setIsConnected(true);
					setError('');
				},
				onOpen: () => {
					setIsConnected(true);
				},
				onError: (event: any) => {
					if (typeof EventSource !== 'undefined' && event?.target?.readyState === EventSource.CLOSED) {
						setIsConnected(false);
					}
				},
			});

			return () => {
				if (stream && typeof stream.close === 'function') {
					stream.close();
				}
			};
		};

		let cleanup: (() => void) | void;
		void bootstrap().then((maybeCleanup) => {
			cleanup = maybeCleanup;
		});

		return () => {
			isMounted = false;
			if (cleanup) cleanup();
		};
	}, []);

	const handleAddTag = async (tag: string) => {
		const nextTag = normalizeTagValue(tag);
		if (!nextTag) return;
		setIsRefreshing(true);
		setError('');

		try {
			await addContextTags([nextTag]);
			setSelectedTag(nextTag);
			// Do not force a full refresh here (it's CPU-intensive). Rely on the background
			// refresh the server started and SSE to deliver the updated snapshot.
			// Load the current monitor state without forcing refresh so the UI updates
			// with available data but doesn't trigger heavy processing.
			await loadMonitor({ refresh: false });
		} catch (err: any) {
			setError(err?.message || 'Unable to save tag right now.');
		} finally {
			setIsRefreshing(false);
		}
	};

	const handleClearTag = () => {
		setSelectedTag('');
	};

	const handleRefresh = async () => {
		if (isRefreshing) return;
		setIsRefreshing(true);
		await loadMonitor({ refresh: true });
		setIsRefreshing(false);
	};

	return (
		<div className='dark-route-shell news-deck-shell'>
			<header className='news-deck-header'>
				<div>
					<h1>Live News Deck</h1>
					<p className='news-deck-subtitle'>A live SSE-powered news deck for context feed snapshots and tagged feed monitoring.</p>
				</div>

				<div className='news-deck-header-actions'>
					<button
						className='btn btn-secondary'
						type='button'
						onClick={handleRefresh}
						disabled={isRefreshing}>
						{isRefreshing ? 'Refreshing…' : 'Refresh Now'}
					</button>
					<span className={`status-pill ${isConnected ? 'status-online' : 'status-offline'}`}>{isConnected ? 'SSE Connected' : 'SSE Offline'}</span>
				</div>
			</header>

			<section className='news-deck-status'>
				<div>
					<strong>Status:</strong> {monitor ? formatRelativeTime(monitor.lastUpdatedAt) : 'Waiting for feed data…'}
				</div>
				<div>
					<strong>Stream version:</strong> {monitor?.streamVersion ?? 'N/A'}
				</div>
				<div>
					<strong>Tags:</strong>{' '}
					{tagOptions.length ?
						tagOptions.map((tag) => (
							<button
								key={tag}
								type='button'
								className={`tag-chip ${tag === activeTag ? 'is-active' : ''}`}
								onClick={() => setSelectedTag(tag)}>
								{tag}
							</button>
						))
					:	<span className='news-deck-empty'>No active tags yet.</span>}
				</div>
				{error && <div className='news-deck-error'>Error: {error}</div>}
			</section>

			<section className='news-deck-columns'>
				<ContextFeedColumn
					columnKey='tagged'
					monitor={monitor || {}}
					activeTag={activeTag}
					contextFilter='news'
					columnTitle={activeTag ? `Tag: ${activeTag}` : 'Tagged News'}
					allowActiveTagClear={Boolean(activeTag)}
					onClearActiveTag={handleClearTag}
					onAddTag={handleAddTag}
					onSelectTag={setSelectedTag}
					showComposer={true}
					draftTagValue={selectedTag}
					onDraftTagChange={setSelectedTag}
				/>
			</section>
		</div>
	);
}
