import type { ArticleArchiveType } from "~/types/ArticleArchiveType";
import type { RSSItem } from "~/types/RSSType";
import { ghostApiWithRetry } from "~/libs/ghostClient";
import { RSSClient } from "~/libs/rssClient";
import { CONFIG } from "~/libs/config";

export class ArticleAggregator {
	private static convertRSSToArticle(rssItem: RSSItem): ArticleArchiveType {
		return {
			slug: rssItem.link, // RSS記事の場合はURLをslugとして使用
			published_at: rssItem.published_at,
			title: rssItem.title,
			source: rssItem.source,
			isExternal: true,
			externalUrl: rssItem.link,
		};
	}

	private static convertGhostToArticle(post: {
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

	static async getLatestArticles(
		options: { limit?: number; includeExternal?: boolean } = {},
	): Promise<ArticleArchiveType[]> {
		const { limit = 10, includeExternal = true } = options;

		const articles: ArticleArchiveType[] = [];

		// Ghost記事の取得（レート制限時はスキップ）
		try {
			const ghostPosts = await ghostApiWithRetry.posts.browse({
				order: "published_at DESC",
				limit: Math.min(limit, 10), // さらに控えめに調整
			});

			if (ghostPosts) {
				const ghostArticles = ghostPosts.map(this.convertGhostToArticle);
				articles.push(...ghostArticles);
			}
		} catch (error) {
			console.warn("Ghost posts unavailable (rate limit or error), showing RSS content only:", error.message);
			// Ghost APIがレート制限の場合はRSSのみ表示
		}

		// RSS記事の取得
		if (includeExternal && CONFIG.externalBlogs.length > 0) {
			try {
				const rssItems = await RSSClient.fetchMultipleRSS(CONFIG.externalBlogs);
				const rssArticles = rssItems.map(this.convertRSSToArticle);
				articles.push(...rssArticles);
			} catch (error) {
				console.error("Failed to fetch RSS posts:", error);
			}
		}

		// 日付でソートして制限数まで取得
		return articles
			.sort((a, b) => {
				const dateA = typeof a.published_at === 'string' 
					? new Date(a.published_at).getTime() 
					: new Date(`${a.published_at.year}-${a.published_at.month.toString().padStart(2, '0')}-${a.published_at.day.toString().padStart(2, '0')}`).getTime();
				const dateB = typeof b.published_at === 'string' 
					? new Date(b.published_at).getTime() 
					: new Date(`${b.published_at.year}-${b.published_at.month.toString().padStart(2, '0')}-${b.published_at.day.toString().padStart(2, '0')}`).getTime();
				return dateB - dateA; // 新しい順
			})
			.slice(0, limit);
	}

	static async getFeaturedArticles(
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
				return ghostPosts.map(this.convertGhostToArticle);
			}
		} catch (error) {
			console.error("Failed to fetch featured Ghost posts:", error);
		}

		return [];
	}
}
