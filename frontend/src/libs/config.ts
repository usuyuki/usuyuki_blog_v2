import type { ExternalBlogConfig } from "~/types/RSSType";
import astroLogger from "./astroLogger";
import errorHandler from "./errorHandler";

function parseExternalBlogs(envVar?: string): ExternalBlogConfig[] {
	if (!envVar) {
		return [];
	}

	try {
		const parsed = JSON.parse(envVar);
		if (!Array.isArray(parsed)) {
			astroLogger.warn("EXTERNAL_BLOGS must be an array", {
				type: "config_validation",
			});
			return [];
		}

		return parsed.filter((blog: object): blog is ExternalBlogConfig => {
			if (typeof blog !== "object" || blog === null) {
				astroLogger.warn("Invalid blog config: not an object", {
					blog,
					type: "config_validation",
				});
				return false;
			}

			const blogObj = blog as Record<string, string>;
			if (
				typeof blogObj.name !== "string" ||
				typeof blogObj.rssUrl !== "string"
			) {
				astroLogger.warn("Invalid blog config: missing name or rssUrl", {
					blog,
					type: "config_validation",
				});
				return false;
			}

			return true;
		});
	} catch (error) {
		errorHandler.handleError(error as Error, {
			type: "config_parse_error",
			envVar: "EXTERNAL_BLOGS",
		});
		return [];
	}
}

export const CONFIG = {
	externalBlogs: parseExternalBlogs(import.meta.env.EXTERNAL_BLOGS),
} as const;
