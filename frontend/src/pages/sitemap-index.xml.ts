import type { APIRoute } from "astro";
import { ghostApiWithRetry } from "~/libs/ghostClient";
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
		// Ghost記事を取得（ページネーション対応）
		let allPosts: GhostPost[] = [];
		let page = 1;
		const limit = 100;

		while (true) {
			const posts = (await ghostApiWithRetry.posts.browse(
				{
					limit,
					page,
					fields: "slug,updated_at,published_at",
					filter: "status:published",
					order: "published_at DESC",
				},
				3,
				request,
			)) as GhostPost[] | null;

			if (!posts || posts.length === 0) {
				break;
			}

			allPosts = allPosts.concat(posts);

			if (posts.length < limit) {
				break;
			}

			page++;
		}

		const posts = allPosts;

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
