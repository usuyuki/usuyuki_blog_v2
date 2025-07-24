import type { APIRoute } from 'astro';
import { ghostApiWithRetry } from '~/libs/ghostClient';

export const GET: APIRoute = async ({ url }) => {
	const offset = parseInt(url.searchParams.get('offset') || '0');

	// offset月前から6ヶ月分の記事を取得
	const startDate = new Date();
	startDate.setMonth(startDate.getMonth() - offset - 6);

	const endDate = new Date();
	endDate.setMonth(endDate.getMonth() - offset);

	try {
		const posts = await ghostApiWithRetry.posts.browse({
			filter: `published_at:>='${startDate.toISOString()}'+published_at:<'${endDate.toISOString()}'`,
			limit: 'all',
			order: 'published_at DESC'
		});

		return new Response(JSON.stringify({ posts: posts || [] }), {
			status: 200,
			headers: {
				'Content-Type': 'application/json'
			}
		});
	} catch (error) {
		console.error('Archive API error:', error);
		return new Response(JSON.stringify({ error: 'Failed to fetch posts' }), {
			status: 500,
			headers: {
				'Content-Type': 'application/json'
			}
		});
	}
};
