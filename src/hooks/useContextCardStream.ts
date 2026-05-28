import { useEffect, useRef, useCallback } from 'react';

type CardDetail = any;
type Handler = (detail: CardDetail) => void;

export default function useContextCardStream({ enabled = true } = {}) {
	// Keep handler sets in a ref so callers can subscribe/unsubscribe without re-rendering
	const handlersRef = useRef({
		added: new Set<Handler>(),
		updated: new Set<Handler>(),
		removed: new Set<Handler>(),
	});

	useEffect(() => {
		if (!enabled) return undefined;

		const onAdded = (e: Event) => {
			const detail = (e as CustomEvent).detail;
			for (const h of handlersRef.current.added) h(detail);
		};

		const onUpdated = (e: Event) => {
			const detail = (e as CustomEvent).detail;
			for (const h of handlersRef.current.updated) h(detail);
		};

		const onRemoved = (e: Event) => {
			const detail = (e as CustomEvent).detail;
			for (const h of handlersRef.current.removed) h(detail);
		};

		window.addEventListener('context:card-added', onAdded as EventListener);
		window.addEventListener('context:card-updated', onUpdated as EventListener);
		window.addEventListener('context:card-removed', onRemoved as EventListener);

		return () => {
			window.removeEventListener('context:card-added', onAdded as EventListener);
			window.removeEventListener('context:card-updated', onUpdated as EventListener);
			window.removeEventListener('context:card-removed', onRemoved as EventListener);
		};
	}, [enabled]);

	const subscribe = useCallback((type: 'added' | 'updated' | 'removed', handler: Handler) => {
		handlersRef.current[type].add(handler);
		return () => {
			handlersRef.current[type].delete(handler);
		};
	}, []);

	return { subscribe };
}
