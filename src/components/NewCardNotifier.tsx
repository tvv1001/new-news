'use client';

import { useEffect, useState } from 'react';
import useContextCardStreamSubject from '../hooks/useContextCardStreamSubject';

export default function NewCardNotifier({ max = 5 }: { max?: number }) {
	const { subscribe, getLatest } = useContextCardStreamSubject({ enabled: true, bufferSize: 50 });
	const [recent, setRecent] = useState<any[]>([]);

	useEffect(() => {
		setRecent(getLatest(max));
		const unsub = subscribe('added', (card) => {
			setRecent((cur) => {
				const next = [card, ...cur.filter((c) => String(c.id) !== String(card.id))].slice(0, max);
				return next;
			});
		});
		return () => {
			unsub();
		};
	}, [getLatest, subscribe, max]);

	if (!recent || recent.length === 0) return null;

	return (
		<div
			className='new-card-notifier'
			style={{ position: 'fixed', right: 16, bottom: 16, zIndex: 9999 }}>
			{recent.map((r) => (
				<div
					key={r.id}
					style={{ background: '#0b0b0b', color: '#fff', padding: 8, marginBottom: 8, borderRadius: 6, minWidth: 280 }}>
					<strong style={{ display: 'block' }}>{r.title || r.headline || r.titleRaw || 'New item'}</strong>
					<div style={{ fontSize: 12, opacity: 0.85 }}>{r.source || r.domain}</div>
				</div>
			))}
		</div>
	);
}
