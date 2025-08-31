import type { APIRoute } from "astro";
import { getLatestArticles } from "~/libs/articleAggregator";
import { SITE_URL } from "~/consts";
import astroLogger from "~/libs/astroLogger";
import { LOG_TYPES } from "~/libs/logTypes";

// Ghost Post type
interface GhostPost {
	slug: string;
	updated_at: string;
	published_at: string;
}

export const GET: APIRoute = async ({ request }) => {
	try {
		// getLatestArticles関数で全記事取得（Ghost記事のみ）
		const allArticles = await getLatestArticles({
			includeExternal: false, // サイトマップにはGhost記事のみ
			unlimited: true, // 全記事を取得
		});

		// ArticleArchiveType から GhostPost 形式に変換
		const posts: GhostPost[] = allArticles.map((article) => ({
			slug: article.slug,
			published_at:
				typeof article.published_at === "string"
					? article.published_at
					: `${article.published_at.year}-${article.published_at.month.toString().padStart(2, "0")}-${article.published_at.day.toString().padStart(2, "0")}T00:00:00.000Z`,
			updated_at:
				typeof article.published_at === "string"
					? article.published_at
					: `${article.published_at.year}-${article.published_at.month.toString().padStart(2, "0")}-${article.published_at.day.toString().padStart(2, "0")}T00:00:00.000Z`,
		}));

		astroLogger.info(
			`Sitemap: Found ${posts?.length || 0} posts from Ghost API`,
			{
				logType: LOG_TYPES.API,
				count: posts?.length || 0,
				service: "sitemap",
			},
		);
		if (posts && posts.length > 0) {
			const sortedByDate = posts.sort(
				(a: GhostPost, b: GhostPost) =>
					new Date(b.published_at).getTime() -
					new Date(a.published_at).getTime(),
			);
			astroLogger.info(
				`Sitemap: Latest post date: ${sortedByDate[0]?.published_at}`,
				{
					logType: LOG_TYPES.API,
					service: "sitemap",
					latestDate: sortedByDate[0]?.published_at,
				},
			);
			astroLogger.info(
				`Sitemap: Oldest post date: ${sortedByDate[sortedByDate.length - 1]?.published_at}`,
				{
					logType: LOG_TYPES.API,
					service: "sitemap",
					oldestDate: sortedByDate[sortedByDate.length - 1]?.published_at,
				},
			);
		}

		// 最新記事の更新日を取得
		const latestPostDate =
			posts && posts.length > 0
				? new Date(
						Math.max(
							...posts.map((post: GhostPost) =>
								new Date(post.updated_at || post.published_at).getTime(),
							),
						),
					)
						.toISOString()
						.split("T")[0]
				: new Date().toISOString().split("T")[0];

		// 静的ページのURL
		const staticPages = [
			{
				url: `${SITE_URL}/`,
				lastmod: latestPostDate,
			},
			{
				url: `${SITE_URL}/aboutThisBlog`,
				lastmod: "2025-08-24", // 固定日付
			},
			{
				url: `${SITE_URL}/archive`,
				lastmod: latestPostDate,
			},
		];

		// Ghost記事のURL
		const postPages =
			posts?.map((post: GhostPost) => ({
				url: `${SITE_URL}/${post.slug}`,
				lastmod: new Date(post.updated_at || post.published_at)
					.toISOString()
					.split("T")[0],
			})) || [];

		const allPages = [...staticPages, ...postPages];

		const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allPages
	.map(
		(page) => `  <url>
    <loc>${page.url}</loc>
    <lastmod>${page.lastmod}</lastmod>
  </url>`,
	)
	.join("\n")}
</urlset>`;

		return new Response(sitemap, {
			headers: {
				"Content-Type": "application/xml",
				"Cache-Control": "public, max-age=3600", // 1時間キャッシュ
			},
		});
	} catch (error) {
		astroLogger.requestError(
			"Error generating sitemap:",
			request,
			error as Error,
			{
				logType: LOG_TYPES.ERROR,
				service: "sitemap",
			},
		);

		// エラー時は最小限のサイトマップを返す
		const fallbackSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${SITE_URL}/</loc>
    <lastmod>${new Date().toISOString().split("T")[0]}</lastmod>
  </url>
</urlset>`;

		return new Response(fallbackSitemap, {
			headers: {
				"Content-Type": "application/xml",
			},
		});
	}
};
