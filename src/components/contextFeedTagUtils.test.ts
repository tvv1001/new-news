import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeContextTagForSync, normalizeContextTagValue } from './contextFeedTagUtils.ts';

test('normalizeContextTagValue lowercases and trims context tags', () => {
	assert.equal(normalizeContextTagValue('  AI Policy  '), 'ai policy');
});

test('normalizeContextTagForSync normalizes the active tag for syncing', () => {
	assert.equal(normalizeContextTagForSync('  all-news  '), 'all-news');
	assert.equal(normalizeContextTagForSync(' AI Policy '), 'ai policy');
});
