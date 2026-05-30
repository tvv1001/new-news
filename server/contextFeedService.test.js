import test from 'node:test';
import assert from 'node:assert/strict';

import { buildContextMatchCandidates, extractFeedItemPreviewImages, hydrateMatch, resolveContextMatchPreviewMedia } from './services/context/contextFeedService.js';

test('extractFeedItemPreviewImages keeps multiple inline images from feed HTML fragments', () => {
	const images = extractFeedItemPreviewImages(
		{
			link: 'https://www.reddit.com/r/gangstalking1/comments/example/gallery-post/',
			content: `
				<div>
					<img src="https://preview.redd.it/first-image.jpg?width=320&format=pjpg&auto=webp" alt="first image" />
					<p>gallery item</p>
					<img src="https://preview.redd.it/second-image.jpg?width=320&format=pjpg&auto=webp" alt="second image" />
				</div>
			`,
		},
		{},
	);

	assert.equal(images.length, 2);
	assert.match(images[0].src, /first-image\.jpg/i);
	assert.match(images[1].src, /second-image\.jpg/i);
});

test('resolveContextMatchPreviewMedia expands reddit thread matches into gallery images', async () => {
	const previewMedia = await resolveContextMatchPreviewMedia(
		{
			link: 'https://www.reddit.com/r/gangstalking1/comments/example/gallery-post/',
			previewImage: {
				src: 'https://preview.redd.it/first-image.jpg?width=320&format=pjpg&auto=webp',
				alt: 'first image',
			},
		},
		{
			loader: async () => ({
				previewImage: {
					src: 'https://preview.redd.it/first-image.jpg?width=320&format=pjpg&auto=webp',
					alt: 'first image',
				},
				imageContext: {
					renderableEntries: [
						{
							src: 'https://preview.redd.it/first-image.jpg?width=320&format=pjpg&auto=webp',
							alt: 'first image',
						},
						{
							src: 'https://preview.redd.it/second-image.jpg?width=320&format=pjpg&auto=webp',
							alt: 'second image',
						},
					],
				},
			}),
		},
	);

	assert.ok(previewMedia);
	assert.equal(previewMedia.previewImages.length, 2);
	assert.equal(previewMedia.previewImages[0].alt, 'first image');
	assert.equal(previewMedia.previewImages[1].alt, 'second image');
});

test('resolveContextMatchPreviewMedia uses commentsLink fallback for reddit galleries', async () => {
	const attemptedUrls = [];
	const commentsLink = 'https://www.reddit.com/r/gangstalking1/comments/example-commentslink/gallery-post/';

	const previewMedia = await resolveContextMatchPreviewMedia(
		{
			link: 'https://example.com/original-story',
			originalLink: 'https://example.com/original-story',
			commentsLink,
			previewImage: {
				src: 'https://preview.redd.it/first-image.jpg?width=320&format=pjpg&auto=webp',
				alt: 'first image',
			},
		},
		{
			loader: async (url) => {
				attemptedUrls.push(url);
				return {
					imageContext: {
						renderableEntries: [
							{
								src: 'https://preview.redd.it/first-image.jpg?width=320&format=pjpg&auto=webp',
								alt: 'first image',
							},
							{
								src: 'https://preview.redd.it/second-image.jpg?width=320&format=pjpg&auto=webp',
								alt: 'second image',
							},
						],
					},
				};
			},
		},
	);

	assert.ok(previewMedia);
	assert.equal(previewMedia.previewImages.length, 2);
	assert.equal(attemptedUrls[0], commentsLink);
});

test('hydrateMatch carries inline video media into feed cards', () => {
	const candidate = hydrateMatch(
		{ context: 'news', source: 'Reddit · r/V2KTRUTH', type: 'tag-template-instance', templateTag: 'v2k' },
		{
			title: 'V2K implants',
			link: 'https://www.reddit.com/r/V2KTRUTH/comments/1trhggt/v2k_implants/',
			guid: 'https://www.reddit.com/r/V2KTRUTH/comments/1trhggt/v2k_implants/',
			content: '<div><video controls src="https://v.redd.it/example/DASH_720.mp4"></video></div>',
		},
		[],
	);

	assert.equal(candidate.previewMedia?.type, 'video');
	assert.equal(candidate.previewMedia?.src, 'https://v.redd.it/example/DASH_720.mp4');
});

test('hydrateMatch falls back to reddit embeds for self posts without external links', () => {
	const candidate = hydrateMatch(
		{ context: 'news', source: 'Reddit · r/V2KTRUTH', type: 'tag-template-instance', templateTag: 'v2k' },
		{
			title: 'V2K implants',
			link: 'https://www.reddit.com/r/V2KTRUTH/comments/1trhggt/v2k_implants/',
			guid: 'https://www.reddit.com/r/V2KTRUTH/comments/1trhggt/v2k_implants/',
			content: '<p>self post</p>',
		},
		[],
	);

	assert.equal(candidate.previewMedia?.type, 'reddit-embed');
	assert.equal(candidate.previewMedia?.src, 'https://www.reddit.com/r/V2KTRUTH/comments/1trhggt/v2k_implants/');
});

test('buildContextMatchCandidates preserves reddit self-post body on the primary card', () => {
	const candidates = buildContextMatchCandidates(
		{ context: 'news', source: 'Reddit · r/PandemicChan' },
		{
			title: 'Ebola-chan! (2014)',
			link: 'https://www.reddit.com/r/PandemicChan/comments/1trn5ic/ebolachan_2014/',
			guid: 'https://www.reddit.com/r/PandemicChan/comments/1trn5ic/ebolachan_2014/',
			content:
				'<div><p>A subreddit dedicated to Hanta-chan, Ebola-chan, and Vaccine-chan.</p><p>Archival art post.</p></div>',
		},
	);

	assert.equal(candidates.length, 1);
	assert.match(candidates[0].__matchText, /archival art post/i);
	assert.match(String(candidates[0].content || ''), /archival art post/i);
});
