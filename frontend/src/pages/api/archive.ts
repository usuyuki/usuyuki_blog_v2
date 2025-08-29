import type { APIRoute } from "astro";
import type { ArticleArchiveType } from "~/types/ArticleArchiveType";
import { getLatestArticles } from "~/libs/articleAggregator";
import { cache, ONE_HOUR_MS } from "~/libs/cache";
import errorHandler from "~/libs/errorHandler";

export const GET: APIRoute = async ({ url, request }) => {
	const beforeDate = url.searchParams.get("before");
	const limit = parseInt(url.searchParams.get("limit") || "12", 10);

	try {
		const cacheKey = "archive:all-articles";

		// キャッシュから全記事を取得を試行
		let allArticles = cache.get<ArticleArchiveType[]>(cacheKey);
		if (!allArticles) {
			// getLatestArticles関数を使用してGhost記事とRSS記事を統合取得
			allArticles = await getLatestArticles({
				limit: 500, // より多くの記事を取得
				includeExternal: true,
			});

			// キャッシュに保存
			cache.set(cacheKey, allArticles, ONE_HOUR_MS);
		}

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
		const nextBefore =
			hasMore && paginatedPosts.length > 0
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
		errorHandler.handleApiError("/api/archive", error as Error, {
			beforeDate: beforeDate || undefined,
			limit,
			request,
		});
		return new Response(JSON.stringify({ error: "Failed to fetch posts" }), {
			status: 500,
			headers: {
				"Content-Type": "application/json",
			},
		});
	}
};
