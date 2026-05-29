'use client';

import { useEffect } from 'react';

export default function useBodyClass(className: string | string[] | null) {
	useEffect(() => {
		const normalized =
			Array.isArray(className) ?
				className
					.map((value) => String(value || '').trim())
					.filter(Boolean)
					.join(' ')
			:	String(className || '').trim();

		const previousClassName = document.body.className;
		document.body.className = normalized;

		return () => {
			document.body.className = previousClassName;
		};
	}, [className]);
}
