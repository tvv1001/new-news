import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { mkdtemp, readFile, rm } from 'node:fs/promises';

test('context keywords persist to disk until explicitly removed', async () => {
	const tempDir = await mkdtemp(path.join(tmpdir(), 'query-notify-keywords-'));
	const keywordsFile = path.join(tempDir, 'context-keywords.json');
	const previousKeywordsFile = process.env.CONTEXT_KEYWORDS_FILE;
	process.env.CONTEXT_KEYWORDS_FILE = keywordsFile;

	try {
		const moduleUrl = new URL(`./services/context/contextFeedService.js?persist=${Date.now()}`, import.meta.url);
		const {
			getContextFeedSnapshot,
			loadPersistedContextKeywords,
			replaceContextKeywords,
			resetContextFeedMonitorForTests,
			savePersistedContextKeywords,
		} = await import(moduleUrl.href);

		resetContextFeedMonitorForTests();
		replaceContextKeywords([' First Tag ', 'second tag', 'first tag']);
		await savePersistedContextKeywords();

		const savedPayload = JSON.parse(await readFile(keywordsFile, 'utf-8'));
		assert.deepEqual(savedPayload, ['first tag', 'second tag']);

		replaceContextKeywords([]);
		assert.deepEqual(getContextFeedSnapshot().tags, []);

		await loadPersistedContextKeywords();
		assert.deepEqual(getContextFeedSnapshot().tags, ['first tag', 'second tag']);
	} finally {
		if (previousKeywordsFile === undefined) {
			delete process.env.CONTEXT_KEYWORDS_FILE;
		} else {
			process.env.CONTEXT_KEYWORDS_FILE = previousKeywordsFile;
		}
		await rm(tempDir, { recursive: true, force: true });
	}
});
