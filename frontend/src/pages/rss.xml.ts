import rss from "@astrojs/rss";
import { SITE_DESCRIPTION, SITE_TITLE, SITE_URL } from "~/consts";
import { ghostApiWithRetry } from "~/libs/ghostClient";
import astroLogger from "~/libs/astroLogger";

export async function GET(context: { request: Request }) {
	try {
		// Ghost APIから直接記事を取得（excerptを含む）
		const latestArticles = await ghostApiWithRetry.posts.browse({
			order: "published_at DESC",
			limit: 50,
			include: "tags,authors",
		}, 3, context.request);

		if (!latestArticles || latestArticles.length === 0) {
			const error = new Error("No articles available for RSS feed");
			astroLogger.apiRequestError("/rss.xml", context.request, error, {
				route: "/rss.xml",
				status: 500,
			});
			return new Response("Internal Server Error", { status: 500 });
		}

		return rss({
			title: SITE_TITLE,
			description: SITE_DESCRIPTION,
			site: SITE_URL,
			customData: "<language>ja</language>",
			items: latestArticles.map((article) => ({
				title: article.title || "",
				pubDate: new Date(article.published_at || ""),
				link: `/${article.slug}`,
				content: article.excerpt || article.title || "",
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
