import rss from "@astrojs/rss";
import { SITE_DESCRIPTION, SITE_TITLE, SITE_URL } from "~/consts";
import { ghostClient } from "~/libs/ghostClient";
import astroLogger from "~/libs/astroLogger";
import errorHandler from "~/libs/errorHandler";

export async function GET() {
	const posts = await ghostClient.posts
		.browse({
			limit: "all",
		})
		.catch((err: Error) => {
			errorHandler.handleError(err, { route: "/rss.xml" });
		});

	//catchでとれないことがあるので
	if (posts === undefined) {
		astroLogger.error("postsが正しく取得できません", undefined, {
			route: "/rss.xml",
		});
	} else {
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
}
