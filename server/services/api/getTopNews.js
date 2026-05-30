// Minimal Hacker News top stories fetcher used to augment the context feed.
// Enable in the feed monitor by setting INCLUDE_TOP_NEWS=1 in the environment.

const HN_TOPSTORIES_URL = 'https://hacker-news.firebaseio.com/v0/topstories.json';
const HN_ITEM_URL = (id) => `https://hacker-news.firebaseio.com/v0/item/${id}.json`;

export default class getTopNews {
	async getStories(limit = 30) {
		try {
			const idsResp = await fetch(HN_TOPSTORIES_URL);
			if (!idsResp.ok) return [];
			const ids = await idsResp.json();
			const slice = Array.isArray(ids) ? ids.slice(0, limit) : [];

			const data = await Promise.all(
				slice.map(async (i) => {
					try {
						const item = await (await fetch(`${HN_ITEM_URL(i)}?print=pretty`)).json();
						return item;
					} catch (err) {
						return null;
					}
				}),
			);

			return data.filter(Boolean);
		} catch (err) {
			return [];
		}
	}
}
