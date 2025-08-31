import rss from "@astrojs/rss";
import { SITE_DESCRIPTION, SITE_TITLE, SITE_URL } from "~/consts";
import { ghostClient } from "~/libs/ghostClient";
import astroLogger from "~/libs/astroLogger";

export async function GET(context: { request: Request }) {
	const posts = await ghostClient.posts
		.browse({
			limit: "all",
		})
		.catch((err: Error) => {
			astroLogger.apiRequestError("/rss.xml", context.request, err, {
				route: "/rss.xml",
			});
			return undefined;
		});

	if (posts === undefined) {
		const error = new Error("Failed to fetch posts from Ghost API");
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
		// biome-ignore lint/suspicious/noExplicitAny: Ghost API response type is complex
		items: posts.map((post: any) => ({
			title: post.title,
			pubDate: post.published_at,
			link: `/${post.slug}`,
			content: post.excerpt,
		})),
	});
}
