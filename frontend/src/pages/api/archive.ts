import type { APIRoute } from "astro";
import { ArticleAggregator } from "~/libs/articleAggregator";

export const GET: APIRoute = async ({ url }) => {
	const beforeDate = url.searchParams.get("before");
	const limit = parseInt(url.searchParams.get("limit") || "12");

	try {
		// ArticleAggregatorを使用してGhost記事とRSS記事を統合取得
		const allArticles = await ArticleAggregator.getLatestArticles({
			limit: 500, // より多くの記事を取得
			includeExternal: true,
		});

		// 記事を日付順にソート（新しい順）
		const sortedArticles = allArticles.sort((a, b) => {
			const dateA = new Date(a.published_at as string).getTime();
			const dateB = new Date(b.published_at as string).getTime();
			return dateB - dateA;
		});

		// beforeパラメータでフィルタリング
		let filteredArticles = sortedArticles;
		if (beforeDate) {
			const beforeDateTime = new Date(beforeDate).getTime();
			filteredArticles = sortedArticles.filter((article) => {
				const articleTime = new Date(article.published_at as string).getTime();
				return articleTime < beforeDateTime;
			});
		}

		// 指定された件数だけ取得
		const paginatedPosts = filteredArticles.slice(0, limit);

		// 次のページがあるかチェック
		const hasMore = filteredArticles.length > limit;
		const nextBefore = hasMore && paginatedPosts.length > 0 
			? paginatedPosts[paginatedPosts.length - 1].published_at
			: null;

		return new Response(
			JSON.stringify({
				posts: paginatedPosts,
				hasMore,
				nextBefore,
				totalArticles: allArticles.length,
			}),
			{
				status: 200,
				headers: {
					"Content-Type": "application/json",
				},
			},
		);
	} catch (error) {
		console.error("Archive API error:", error);
		return new Response(JSON.stringify({ error: "Failed to fetch posts" }), {
			status: 500,
			headers: {
				"Content-Type": "application/json",
			},
		});
	}
};