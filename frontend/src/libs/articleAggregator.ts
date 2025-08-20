import type { ArticleArchiveType } from "~/types/ArticleArchiveType";
import type { RSSItem, ExternalBlogConfig } from "~/types/RSSType";
import { ghostApiWithRetry } from "~/libs/ghostClient";
import { fetchMultipleRSS } from "~/libs/rssClient";
import { CONFIG } from "~/libs/config";
import astroLogger from "./astroLogger";
import errorHandler from "./errorHandler";

function convertRSSToArticle(
	rssItem: RSSItem,
	blogConfig?: ExternalBlogConfig,
): ArticleArchiveType {
	return {
		slug: rssItem.link, // RSS記事の場合はURLをslugとして使用
		published_at: rssItem.published_at,
		title: rssItem.title,
		source: blogConfig?.name || rssItem.source, // 環境変数のnameを優先使用
		isExternal: true,
		externalUrl: rssItem.link,
		sourceColor: blogConfig?.color,
	};
}

function convertGhostToArticle(post: {
	slug: string;
	published_at: string;
	feature_image?: string;
	title: string;
}): ArticleArchiveType {
	return {
		slug: post.slug,
		published_at: post.published_at,
		feature_image: post.feature_image,
		title: post.title,
		isExternal: false,
	};
}

export async function getLatestArticles(
	options: { limit?: number; includeExternal?: boolean } = {},
): Promise<ArticleArchiveType[]> {
	const { limit = 10, includeExternal = true } = options;

	const articles: ArticleArchiveType[] = [];

	// Ghost記事の取得（レート制限時はスキップ）
	try {
		const ghostPosts = await ghostApiWithRetry.posts.browse({
			order: "published_at DESC",
			limit: limit, // limitをそのまま使用してより多くのGhost記事を取得
		});

		if (ghostPosts) {
			const ghostArticles = ghostPosts.map(convertGhostToArticle);
			articles.push(...ghostArticles);
		}
	} catch (error) {
		astroLogger.warn("Ghost posts unavailable (rate limit or error), showing RSS content only", {
			error: (error as Error).message,
			service: 'ghost-api'
		});
		// Ghost APIがレート制限の場合はRSSのみ表示
	}

	// RSS記事の取得
	if (includeExternal && CONFIG.externalBlogs.length > 0) {
		try {
			const rssItems = await fetchMultipleRSS(CONFIG.externalBlogs);
			const rssArticles = rssItems.map((rssItem) => {
				const blogConfig = CONFIG.externalBlogs.find(
					(config) => config.name === rssItem.source,
				);
				return convertRSSToArticle(rssItem, blogConfig);
			});
			articles.push(...rssArticles);
		} catch (error) {
			errorHandler.handleError(error as Error, {
				service: 'rss-aggregator',
				type: 'rss_fetch_error'
			});
		}
	}

	// 日付でソートして制限数まで取得
	return articles
		.sort((a, b) => {
			let dateA: number;
			let dateB: number;

			if (typeof a.published_at === "string") {
				dateA = new Date(a.published_at).getTime();
			} else {
				dateA = new Date(
					`${a.published_at.year}-${a.published_at.month.toString().padStart(2, "0")}-${a.published_at.day.toString().padStart(2, "0")}`,
				).getTime();
			}

			if (typeof b.published_at === "string") {
				dateB = new Date(b.published_at).getTime();
			} else {
				dateB = new Date(
					`${b.published_at.year}-${b.published_at.month.toString().padStart(2, "0")}-${b.published_at.day.toString().padStart(2, "0")}`,
				).getTime();
			}

			return dateB - dateA; // 新しい順
		})
		.slice(0, limit);
}

export async function getFeaturedArticles(
	options: { limit?: number; includeExternal?: boolean } = {},
): Promise<ArticleArchiveType[]> {
	const { limit = 5 } = options;

	// フィーチャー記事はGhostのみから取得
	try {
		const ghostPosts = await ghostApiWithRetry.posts.browse({
			filter: "featured:true",
			order: "published_at DESC",
			limit,
		});

		if (ghostPosts) {
			return ghostPosts.map(convertGhostToArticle);
		}
	} catch (error) {
		errorHandler.handleError(error as Error, {
			service: 'ghost-api',
			method: 'getFeaturedGhostPosts',
			type: 'featured_posts_error'
		});
	}

	return [];
}
