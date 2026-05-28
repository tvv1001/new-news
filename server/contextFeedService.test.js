import test from 'node:test';
import assert from 'node:assert/strict';

import { extractFeedItemPreviewImages, resolveContextMatchPreviewMedia } from './services/context/contextFeedService.js';

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
