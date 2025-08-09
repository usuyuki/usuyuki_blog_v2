import type { APIRoute } from "astro";
import { ArticleAggregator } from "~/libs/articleAggregator";

export const GET: APIRoute = async ({ url }) => {
	const offset = parseInt(url.searchParams.get("offset") || "0");

	try {
		// ArticleAggregatorを使用してGhost記事とRSS記事を統合取得
		const allArticles = await ArticleAggregator.getLatestArticles({
			limit: 200, // アーカイブはより多くの記事を取得
			includeExternal: true,
		});

		// 記事を日付順にソート（新しい順）
		const sortedArticles = allArticles.sort((a, b) => {
			const dateA = new Date(a.published_at as string).getTime();
			const dateB = new Date(b.published_at as string).getTime();
			return dateB - dateA;
		});

		// ページネーションベースのアプローチ（6ヶ月単位ではなく記事数ベース）
		const articlesPerPage = 12; // 1ページあたりの記事数
		const startIndex = offset * articlesPerPage;
		const endIndex = startIndex + articlesPerPage;

		const paginatedPosts = sortedArticles.slice(startIndex, endIndex);

		console.log(`Archive API: offset=${offset}, total=${sortedArticles.length}, returning ${paginatedPosts.length} articles (${startIndex}-${endIndex})`);

		return new Response(JSON.stringify({ 
			posts: paginatedPosts,
			hasMore: endIndex < sortedArticles.length,
			totalArticles: sortedArticles.length,
			currentPage: Math.floor(offset / articlesPerPage)
		}), {
			status: 200,
			headers: {
				"Content-Type": "application/json",
			},
		});
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
