import { useEffect, useRef, useState, useCallback } from 'react';
import useContextCardStream from './useContextCardStream';

type Card = any;

type Subscriber = (card: Card) => void;

/**
 * useContextCardStreamSubject
 * - Keeps a small in-memory buffer of recent added/updated cards
 * - Exposes subscribe(type, handler) to receive live events
 * - Exposes getLatest(n) to read the latest N cards
 */
export default function useContextCardStreamSubject({ enabled = true, bufferSize = 20 } = {}) {
	const { subscribe } = useContextCardStream({ enabled });
	const bufferRef = useRef<Card[]>([]);
	const subscribersRef = useRef({ added: new Set<Subscriber>(), updated: new Set<Subscriber>() });
	const [, setTick] = useState(0); // used to trigger occasional re-renders for callers who read getLatest

	useEffect(() => {
		if (!enabled) return undefined;

		const unsubAdded = subscribe('added', (detail) => {
			const item = detail?.item;
			if (!item) return;
			bufferRef.current.unshift(item);
			if (bufferRef.current.length > bufferSize) bufferRef.current.length = bufferSize;
			for (const s of subscribersRef.current.added) s(item);
			// nudge consumers that read getLatest
			setTick((t) => t + 1);
		});

		const unsubUpdated = subscribe('updated', (detail) => {
			const item = detail?.item;
			if (!item) return;
			// replace if exists
			const idx = bufferRef.current.findIndex((c) => String(c.id) === String(item.id));
			if (idx >= 0) bufferRef.current[idx] = item;
			else bufferRef.current.unshift(item);
			if (bufferRef.current.length > bufferSize) bufferRef.current.length = bufferSize;
			for (const s of subscribersRef.current.updated) s(item);
			setTick((t) => t + 1);
		});

		return () => {
			unsubAdded();
			unsubUpdated();
		};
	}, [enabled, subscribe, bufferSize]);

	const subscribeToSubject = useCallback((type: 'added' | 'updated', handler: Subscriber) => {
		subscribersRef.current[type].add(handler);
		return () => subscribersRef.current[type].delete(handler);
	}, []);

	const getLatest = useCallback((n = 10) => {
		return bufferRef.current.slice(0, n);
	}, []);

	return { subscribe: subscribeToSubject, getLatest };
}
