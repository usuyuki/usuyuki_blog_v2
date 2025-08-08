import type { ExternalBlogConfig } from "~/types/RSSType";

function parseExternalBlogs(envVar?: string): ExternalBlogConfig[] {
	if (!envVar) {
		return [];
	}

	try {
		const parsed = JSON.parse(envVar);
		if (!Array.isArray(parsed)) {
			console.warn("EXTERNAL_BLOGS must be an array");
			return [];
		}

		return parsed.filter((blog: unknown): blog is ExternalBlogConfig => {
			if (typeof blog !== "object" || blog === null) {
				console.warn("Invalid blog config: not an object", blog);
				return false;
			}

			const blogObj = blog as Record<string, unknown>;
			if (
				typeof blogObj.name !== "string" ||
				typeof blogObj.rssUrl !== "string"
			) {
				console.warn("Invalid blog config: missing name or rssUrl", blog);
				return false;
			}

			return true;
		});
	} catch (error) {
		console.error("Failed to parse EXTERNAL_BLOGS:", error);
		return [];
	}
}

export const CONFIG = {
	externalBlogs: parseExternalBlogs(
		import.meta.env.EXTERNAL_BLOGS || process.env.EXTERNAL_BLOGS,
	),
} as const;
