import rss from "@astrojs/rss";
import { SITE_DESCRIPTION, SITE_TITLE, SITE_URL } from "~/consts";
import { getLatestArticles } from "~/libs/articleAggregator";
import astroLogger from "~/libs/astroLogger";

export async function GET(context: { request: Request }) {
	try {
		// getLatestArticles関数でGhost記事のみを全件取得
		const allArticles = await getLatestArticles({
			includeExternal: false, // RSS記事は含めない（RSS XMLにはGhost記事のみ）
			unlimited: true, // 全記事を取得
		});

		if (allArticles.length === 0) {
			const error = new Error("No articles available for RSS feed");
			astroLogger.apiRequestError("/rss.xml", context.request, error, {
				route: "/rss.xml",
				status: 500,
			});
			return new Response("Internal Server Error", { status: 500 });
		}

		// Ghost記事のみをフィルター（念のため）
		const ghostPosts = allArticles.filter((article) => !article.isExternal);

		return rss({
			title: SITE_TITLE,
			description: SITE_DESCRIPTION,
			site: SITE_URL,
			customData: "<language>ja</language>",
			items: ghostPosts.map((article) => ({
				title: article.title,
				pubDate:
					typeof article.published_at === "string"
						? new Date(article.published_at)
						: new Date(
								`${article.published_at.year}-${article.published_at.month.toString().padStart(2, "0")}-${article.published_at.day.toString().padStart(2, "0")}`,
							),
				link: `/${article.slug}`,
				content: article.title, // articleAggregatorではexcerptは含まれないため
			})),
		});
	} catch (err) {
		const error = err instanceof Error ? err : new Error(String(err));
		astroLogger.apiRequestError("/rss.xml", context.request, error, {
			route: "/rss.xml",
		});
		return new Response("Internal Server Error", { status: 500 });
	}
}
