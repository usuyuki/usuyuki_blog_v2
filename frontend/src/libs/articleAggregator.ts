import type {
  ArticleArchiveType,
  ArticleTagType,
} from "~/types/ArticleArchiveType";
import type { RSSItem, ExternalBlogConfig } from "~/types/RSSType";
import { ghostApiWithRetry } from "~/libs/ghostClient";
import { fetchMultipleRSS } from "~/libs/rssClient";
import { fetchQiitaItems } from "~/libs/qiitaClient";
import { CONFIG } from "~/libs/config";
import { cache, ONE_HOUR_MS } from "~/libs/cache";
import astroLogger from "./astroLogger";
import errorHandler from "./errorHandler";

import type { PostOrPage } from "@tryghost/content-api";

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

export function convertGhostToArticle(post: PostOrPage): ArticleArchiveType {
  return {
    slug: post.slug || "",
    published_at: post.published_at || "",
    feature_image: post.feature_image || undefined,
    title: post.title || "",
    excerpt: post.excerpt || undefined,
    source: undefined,
    isExternal: false,
  };
}

export async function getLatestArticles(
  options: {
    limit?: number;
    includeExternal?: boolean;
    unlimited?: boolean;
  } = {},
): Promise<ArticleArchiveType[]> {
  const { limit = 10, includeExternal = true, unlimited = false } = options;

  const articles: ArticleArchiveType[] = [];

  // Ghost記事の取得（ページネーション対応で全記事を取得）
  try {
    let allGhostPosts: ArticleArchiveType[] = [];
    let page = 1;
    const apiLimit = 100; // Ghost v6.0の最大制限

    // unlimitedフラグがtrueの場合は全記事、そうでなければlimit件数まで取得
    const targetLimit = unlimited ? Number.MAX_SAFE_INTEGER : limit;
    const maxPages = unlimited
      ? Number.MAX_SAFE_INTEGER
      : Math.ceil(limit / apiLimit);

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
        include: "tags",
      });

      if (!ghostPosts || ghostPosts.length === 0) {
        // これ以上記事がない場合は終了
        astroLogger.info(
          `No more posts found on page ${page}, stopping pagination`,
          {
            service: "article-aggregator",
            page,
            totalFetched: allGhostPosts.length,
          },
        );
        break;
      }

      allGhostPosts = allGhostPosts.concat(ghostPosts);

      // APIから返された記事数が制限より少ない場合、最後のページ
      if (ghostPosts.length < apiLimit) {
        astroLogger.info(
          `Last page reached (${ghostPosts.length} < ${apiLimit})`,
          {
            service: "article-aggregator",
            page,
            receivedPosts: ghostPosts.length,
            totalFetched: allGhostPosts.length,
          },
        );
        break;
      }

      page++;
    }

    if (allGhostPosts.length > 0) {
      // unlimitedでない場合のみlimit件数まで制限
      const finalGhostPosts = unlimited
        ? allGhostPosts
        : allGhostPosts.slice(0, limit);
      // ghostApiWithRetry.posts.browse は既に ArticleArchiveType[] を返すので変換不要
      articles.push(...finalGhostPosts);

      astroLogger.info(
        `Retrieved ${finalGhostPosts.length} Ghost posts ${unlimited ? "(unlimited)" : `(requested: ${limit})`}`,
        {
          service: "article-aggregator",
          ghostPostsCount: finalGhostPosts.length,
          requestedLimit: unlimited ? "unlimited" : limit,
          totalGhostPosts: allGhostPosts.length,
          pages: page - 1,
          unlimited,
        },
      );
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

  // 外部記事の取得（RSS + Qiita API）
  if (includeExternal && CONFIG.externalBlogs.length > 0) {
    try {
      const rssConfigs = CONFIG.externalBlogs.filter((c) => !c.qiitaUserId);
      const qiitaConfigs = CONFIG.externalBlogs.filter(
        (c): c is ExternalBlogConfig & { qiitaUserId: string } =>
          !!c.qiitaUserId,
      );

      const allResults = await Promise.all([
        fetchMultipleRSS(rssConfigs),
        ...qiitaConfigs.map((c) => fetchQiitaItems(c)),
      ]);
      const externalItems = allResults.flat();

      const externalArticles = externalItems.map((item) => {
        const blogConfig = CONFIG.externalBlogs.find(
          (config) => config.name === item.source,
        );
        return convertRSSToArticle(item, blogConfig);
      });
      articles.push(...externalArticles);
    } catch (error) {
      errorHandler.handleError(error as Error, {
        service: "external-aggregator",
        type: "external_fetch_error",
      });
    }
  }

  // デバッグ情報を出力
  const ghostArticles = articles.filter((a) => !a.isExternal);
  const externalArticles = articles.filter((a) => a.isExternal);

  astroLogger.info(`Article aggregation summary before sorting`, {
    service: "article-aggregator",
    totalArticles: articles.length,
    ghostArticles: ghostArticles.length,
    externalArticles: externalArticles.length,
    unlimited,
    requestedLimit: unlimited ? "unlimited" : limit,
  });

  // 日付でソート（エラーハンドリング追加）
  const sortedArticles = articles.sort((a, b) => {
    let dateA: number;
    let dateB: number;

    try {
      if (typeof a.published_at === "string") {
        dateA = new Date(a.published_at).getTime();
        if (Number.isNaN(dateA)) {
          astroLogger.warn(
            `Invalid date format for article ${a.slug}: ${a.published_at}`,
            {
              service: "article-aggregator",
              slug: a.slug,
              date: a.published_at,
            },
          );
          dateA = 0;
        }
      } else {
        dateA = new Date(
          `${a.published_at.year}-${a.published_at.month.toString().padStart(2, "0")}-${a.published_at.day.toString().padStart(2, "0")}`,
        ).getTime();
      }

      if (typeof b.published_at === "string") {
        dateB = new Date(b.published_at).getTime();
        if (Number.isNaN(dateB)) {
          astroLogger.warn(
            `Invalid date format for article ${b.slug}: ${b.published_at}`,
            {
              service: "article-aggregator",
              slug: b.slug,
              date: b.published_at,
            },
          );
          dateB = 0;
        }
      } else {
        dateB = new Date(
          `${b.published_at.year}-${b.published_at.month.toString().padStart(2, "0")}-${b.published_at.day.toString().padStart(2, "0")}`,
        ).getTime();
      }
    } catch (error) {
      astroLogger.error(
        `Error parsing dates for sorting: ${a.slug} vs ${b.slug}`,
        error as Error,
        {
          service: "article-aggregator",
          slugA: a.slug,
          slugB: b.slug,
          dateA: a.published_at,
          dateB: b.published_at,
        },
      );
      return 0;
    }

    return dateB - dateA; // 新しい順
  });

  const finalArticles = unlimited
    ? sortedArticles
    : sortedArticles.slice(0, limit);

  astroLogger.info(`Article aggregation final result`, {
    service: "article-aggregator",
    finalCount: finalArticles.length,
    unlimited,
    oldestArticle:
      finalArticles.length > 0
        ? finalArticles[finalArticles.length - 1].slug
        : null,
    oldestDate:
      finalArticles.length > 0
        ? finalArticles[finalArticles.length - 1].published_at
        : null,
  });

  return finalArticles;
}

// 全件リストのキャッシュキー(集約ロジックを変えたらバージョンを上げて無効化する)
const ALL_ARTICLES_CACHE_KEY = "aggregated_all_articles:v2";

// 全記事をキャッシュ付きで取得する(一覧ページ・前後記事ナビで共用)
export async function getAllArticlesCached(
  includeExternal = true,
): Promise<ArticleArchiveType[]> {
  const cacheKey = `${ALL_ARTICLES_CACHE_KEY}:${includeExternal ? "all" : "ghost"}`;
  const cached = cache.get<ArticleArchiveType[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const articles = await getLatestArticles({
    includeExternal,
    unlimited: true,
  });
  // 取得失敗などで空のときはキャッシュせず、次のリクエストで再取得させる
  if (articles.length > 0) {
    cache.set(cacheKey, articles, ONE_HOUR_MS);
  }
  return articles;
}

// 記事詳細用: 指定slugの前後の記事を返す
// prev = 1つ古い記事、next = 1つ新しい記事。外部記事(Qiita/Zenn等)はナビに含めない
export async function getAdjacentArticles(slug: string): Promise<{
  prev: ArticleArchiveType | null;
  next: ArticleArchiveType | null;
}> {
  const ghostArticles = await getAllArticlesCached(false);
  // リストは新しい順なので、index+1が古い記事、index-1が新しい記事
  const index = ghostArticles.findIndex((article) => article.slug === slug);
  if (index === -1) {
    return { prev: null, next: null };
  }
  return {
    prev: ghostArticles[index + 1] ?? null,
    next: index > 0 ? ghostArticles[index - 1] : null,
  };
}

// 記事詳細用: タグが共通するGhost記事を関連記事として取得する
// タグなし・該当不足のときは最新記事(自分以外)で補完する
export async function getRelatedArticles(
  post: { slug: string; tags?: ArticleTagType[] },
  options: { limit?: number } = {},
): Promise<ArticleArchiveType[]> {
  const { limit = 3 } = options;
  const tagSlugs = (post.tags ?? [])
    .map((tag) => tag.slug)
    .filter((tagSlug) => tagSlug !== "");

  const related: ArticleArchiveType[] = [];

  if (tagSlugs.length > 0) {
    try {
      const posts = await ghostApiWithRetry.posts.browse({
        filter: `tags:[${tagSlugs.join(",")}]+slug:-${post.slug}`,
        order: "published_at DESC",
        limit,
        include: "tags",
      });
      if (posts) {
        related.push(...posts.slice(0, limit));
      }
    } catch (error) {
      errorHandler.handleError(error as Error, {
        service: "article-aggregator",
        method: "getRelatedArticles",
        type: "related_posts_error",
      });
    }
  }

  // タグ一致だけで埋まらない場合は最新記事で補完
  if (related.length < limit) {
    try {
      const latest = await getLatestArticles({
        includeExternal: false,
        // 自分自身とタグ一致分が除外されても足りるように多めに取る
        limit: limit + related.length + 1,
      });
      for (const article of latest) {
        if (related.length >= limit) break;
        if (article.slug === post.slug) continue;
        if (related.some((r) => r.slug === article.slug)) continue;
        related.push(article);
      }
    } catch (error) {
      errorHandler.handleError(error as Error, {
        service: "article-aggregator",
        method: "getRelatedArticles",
        type: "related_posts_fallback_error",
      });
    }
  }

  return related.slice(0, limit);
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
      include: "tags",
    });

    if (ghostPosts) {
      // ghostApiWithRetry.posts.browse は既に ArticleArchiveType[] を返すので変換不要
      return ghostPosts;
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
