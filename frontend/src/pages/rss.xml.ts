import rss from '@astrojs/rss';
import { SITE_TITLE, SITE_DESCRIPTION, SITE_URL } from '~/consts';
import { ghostClient } from '~/libs/ghostClient';

export async function GET() {
	const posts = await ghostClient.posts
		.browse({
			limit: 'all'
		})
		.catch((err: any) => {
			console.error(err);
		});

	//catchでとれないことがあるので
	if (posts === undefined) {
		console.error('postsが正しく取得できません');
	} else {
		return rss({
			title: SITE_TITLE,
			description: SITE_DESCRIPTION,
			site: SITE_URL,
			customData: '<language>ja</language>',
			// @ts-ignore
			items: posts.map((post) => ({
				title: post.title,
				pubDate: post.published_at,
				link: `/${post.slug}`,
				content: post.excerpt
			}))
		});
	}
}
