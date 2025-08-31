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
	options: { limit?: number; includeExternal?: boolean; unlimited?: boolean } = {},
): Promise<ArticleArchiveType[]> {
	const { limit = 10, includeExternal = true, unlimited = false } = options;

	const articles: ArticleArchiveType[] = [];

	// Ghost記事の取得（ページネーション対応で全記事を取得）
	try {
		let allGhostPosts: any[] = [];
		let page = 1;
		const apiLimit = 100; // Ghost v6.0の最大制限
		
		// unlimitedフラグがtrueの場合は全記事、そうでなければlimit件数まで取得
		const targetLimit = unlimited ? Number.MAX_SAFE_INTEGER : limit;
		const maxPages = unlimited ? Number.MAX_SAFE_INTEGER : Math.ceil(limit / apiLimit);
		
		// ページネーションで記事を取得
		while (page <= maxPages && allGhostPosts.length < targetLimit) {
			astroLogger.info(`Fetching Ghost posts page ${page}`, {
				service: "article-aggregator",
				page,
				currentPostCount: allGhostPosts.length,
				targetLimit,
				maxPages,
				unlimited,
			});
			
			const ghostPosts = await ghostApiWithRetry.posts.browse({
				order: "published_at DESC",
				limit: apiLimit,
				page: page,
			});

			astroLogger.info(`Ghost API response page ${page}: ${ghostPosts?.length || 0} posts`, {
				service: "article-aggregator",
				page,
				receivedPosts: ghostPosts?.length || 0,
				totalSoFar: allGhostPosts.length,
			});

			if (!ghostPosts || ghostPosts.length === 0) {
				// これ以上記事がない場合は終了
				astroLogger.info(`No more posts found on page ${page}, stopping pagination`, {
					service: "article-aggregator",
					page,
					totalFetched: allGhostPosts.length,
				});
				break;
			}

			allGhostPosts = allGhostPosts.concat(ghostPosts);

			// APIから返された記事数が制限より少ない場合、最後のページ
			if (ghostPosts.length < apiLimit) {
				astroLogger.info(`Last page reached (${ghostPosts.length} < ${apiLimit})`, {
					service: "article-aggregator",
					page,
					receivedPosts: ghostPosts.length,
					totalFetched: allGhostPosts.length,
				});
				break;
			}

			page++;
		}

		if (allGhostPosts.length > 0) {
			// unlimitedでない場合のみlimit件数まで制限
			const finalGhostPosts = unlimited ? allGhostPosts : allGhostPosts.slice(0, limit);
			const ghostArticles = finalGhostPosts.map(convertGhostToArticle);
			articles.push(...ghostArticles);
			
			astroLogger.info(`Retrieved ${finalGhostPosts.length} Ghost posts ${unlimited ? '(unlimited)' : `(requested: ${limit})`}`, {
				service: "article-aggregator",
				ghostPostsCount: finalGhostPosts.length,
				requestedLimit: unlimited ? 'unlimited' : limit,
				totalGhostPosts: allGhostPosts.length,
				pages: page - 1,
				unlimited,
			});
		}
	} catch (error) {
		astroLogger.warn(
			"Ghost posts unavailable (rate limit or error), showing RSS content only",
			{
				error: (error as Error).message,
				service: "ghost-api",
			},
		);
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
				service: "rss-aggregator",
				type: "rss_fetch_error",
			});
		}
	}

	// デバッグ情報を出力
	const ghostArticles = articles.filter(a => !a.isExternal);
	const externalArticles = articles.filter(a => a.isExternal);
	
	astroLogger.info(`Article aggregation summary before sorting`, {
		service: "article-aggregator",
		totalArticles: articles.length,
		ghostArticles: ghostArticles.length,
		externalArticles: externalArticles.length,
		unlimited,
		requestedLimit: unlimited ? 'unlimited' : limit,
	});

	// 日付でソート（エラーハンドリング追加）
	const sortedArticles = articles.sort((a, b) => {
		let dateA: number;
		let dateB: number;

		try {
			if (typeof a.published_at === "string") {
				dateA = new Date(a.published_at).getTime();
				if (isNaN(dateA)) {
					astroLogger.warn(`Invalid date format for article ${a.slug}: ${a.published_at}`, {
						service: "article-aggregator",
						slug: a.slug,
						date: a.published_at,
					});
					dateA = 0;
				}
			} else {
				dateA = new Date(
					`${a.published_at.year}-${a.published_at.month.toString().padStart(2, "0")}-${a.published_at.day.toString().padStart(2, "0")}`,
				).getTime();
			}

			if (typeof b.published_at === "string") {
				dateB = new Date(b.published_at).getTime();
				if (isNaN(dateB)) {
					astroLogger.warn(`Invalid date format for article ${b.slug}: ${b.published_at}`, {
						service: "article-aggregator",
						slug: b.slug,
						date: b.published_at,
					});
					dateB = 0;
				}
			} else {
				dateB = new Date(
					`${b.published_at.year}-${b.published_at.month.toString().padStart(2, "0")}-${b.published_at.day.toString().padStart(2, "0")}`,
				).getTime();
			}
		} catch (error) {
			astroLogger.error(`Error parsing dates for sorting: ${a.slug} vs ${b.slug}`, error as Error, {
				service: "article-aggregator",
				slugA: a.slug,
				slugB: b.slug,
				dateA: a.published_at,
				dateB: b.published_at,
			});
			return 0;
		}

		return dateB - dateA; // 新しい順
	});
	
	const finalArticles = unlimited ? sortedArticles : sortedArticles.slice(0, limit);
	
	astroLogger.info(`Article aggregation final result`, {
		service: "article-aggregator",
		finalCount: finalArticles.length,
		unlimited,
		oldestArticle: finalArticles.length > 0 ? finalArticles[finalArticles.length - 1].slug : null,
		oldestDate: finalArticles.length > 0 ? finalArticles[finalArticles.length - 1].published_at : null,
	});

	return finalArticles;
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
			service: "ghost-api",
			method: "getFeaturedGhostPosts",
			type: "featured_posts_error",
		});
	}

	return [];
}
