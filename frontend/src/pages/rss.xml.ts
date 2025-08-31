import rss from "@astrojs/rss";
import { SITE_DESCRIPTION, SITE_TITLE, SITE_URL } from "~/consts";
import { ghostClient } from "~/libs/ghostClient";
import astroLogger from "~/libs/astroLogger";

export async function GET(context: { request: Request }) {
	let allPosts: any[] = [];
	let page = 1;
	const limit = 100;

	try {
		while (true) {
			const posts = await ghostClient.posts.browse({
				limit,
				page,
				order: "published_at DESC",
			});

			if (!posts || posts.length === 0) {
				break;
			}

			allPosts = allPosts.concat(posts);

			if (posts.length < limit) {
				break;
			}

			page++;
		}
	} catch (err: any) {
		astroLogger.apiRequestError("/rss.xml", context.request, err, {
			route: "/rss.xml",
		});
		return new Response("Internal Server Error", { status: 500 });
	}

	if (allPosts.length === 0) {
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
		items: allPosts.map((post: any) => ({
			title: post.title,
			pubDate: post.published_at,
			link: `/${post.slug}`,
			content: post.excerpt,
		})),
	});
}
