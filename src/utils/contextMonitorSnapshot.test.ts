import test from 'node:test';
import assert from 'node:assert/strict';

import { applyContextMonitorDiff, mergeContextMonitorSnapshot } from './contextMonitorSnapshot.ts';

test('mergeContextMonitorSnapshot keeps top-level and output matches aligned', () => {
	const snapshot = mergeContextMonitorSnapshot(
		{
			matches: [{ id: 'old', title: 'Old item', context: 'news' }],
			contexts: { news: [{ id: 'old', title: 'Old item', context: 'news' }], research: [], shopping: [] },
			output: { matches: [{ id: 'old', title: 'Old item', context: 'news' }] },
		},
		{
			matches: [{ id: 'new', title: 'New item', context: 'research' }],
			contexts: { news: [], research: [{ id: 'new', title: 'New item', context: 'research' }], shopping: [] },
		},
	);

	assert.deepEqual(snapshot.matches.map((item: any) => item.id), ['new']);
	assert.deepEqual(snapshot.output.matches.map((item: any) => item.id), ['new']);
	assert.deepEqual(snapshot.contexts.news, []);
	assert.deepEqual(snapshot.contexts.research.map((item: any) => item.id), ['new']);
});

test('applyContextMonitorDiff updates top-level matches and rebuilt contexts', () => {
	const snapshot = applyContextMonitorDiff(
		{
			matches: [
				{ id: 'a', title: 'Item A', context: 'news' },
				{ id: 'b', title: 'Item B', context: 'shopping' },
			],
			contexts: {
				news: [{ id: 'a', title: 'Item A', context: 'news' }],
				research: [],
				shopping: [{ id: 'b', title: 'Item B', context: 'shopping' }],
			},
			output: {
				matches: [
					{ id: 'a', title: 'Item A', context: 'news' },
					{ id: 'b', title: 'Item B', context: 'shopping' },
				],
			},
		},
		{
			updated: [{ id: 'a', title: 'Item A updated', context: 'research' }],
			added: [{ id: 'c', title: 'Item C', context: 'news' }],
			removed: ['b'],
		},
	);

	assert.deepEqual(snapshot.matches.map((item: any) => item.id), ['a', 'c']);
	assert.equal(snapshot.matches[0].title, 'Item A updated');
	assert.deepEqual(snapshot.output.matches.map((item: any) => item.id), ['a', 'c']);
	assert.deepEqual(snapshot.contexts.news.map((item: any) => item.id), ['c']);
	assert.deepEqual(snapshot.contexts.research.map((item: any) => item.id), ['a']);
	assert.deepEqual(snapshot.contexts.shopping, []);
});
