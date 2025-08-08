import { describe, it, expect } from "vitest";
import { ArticleAggregator } from "./libs/articleAggregator";
import { CONFIG } from "./libs/config";

describe("ArticleAggregator Integration Test", () => {
	it("should get latest articles including RSS", async () => {
		console.log("CONFIG.externalBlogs:", CONFIG.externalBlogs);

		try {
			const articles = await ArticleAggregator.getLatestArticles({
				limit: 10,
				includeExternal: true,
			});

			console.log(`Found ${articles.length} total articles`);

			const internalArticles = articles.filter(
				(article) => !article.isExternal,
			);
			const externalArticles = articles.filter((article) => article.isExternal);

			console.log(`Internal articles: ${internalArticles.length}`);
			console.log(`External articles: ${externalArticles.length}`);

			// Log first few articles
			articles.slice(0, 5).forEach((article, index) => {
				console.log(
					`${index + 1}. [${article.isExternal ? article.source : "Ghost"}] ${article.title}`,
				);
				console.log(
					`   Published: ${article.published_at} (${typeof article.published_at})`,
				);
				console.log(`   Slug: ${article.slug}`);
				if (article.isExternal) {
					console.log(`   External URL: ${article.externalUrl}`);
				}
			});

			expect(Array.isArray(articles)).toBe(true);

			// Should have some external articles if RSS is working
			if (CONFIG.externalBlogs.length > 0) {
				console.log("Should have external articles...");
				expect(externalArticles.length).toBeGreaterThan(0);

				// Check that external articles have proper structure
				externalArticles.forEach((article) => {
					expect(article.isExternal).toBe(true);
					expect(article.source).toBeDefined();
					expect(article.externalUrl).toBeDefined();
					expect(typeof article.published_at).toBe("string");
				});
			}

			// Check that articles are properly sorted (newest first)
			for (let i = 1; i < articles.length; i++) {
				const currentDate = new Date(
					articles[i - 1].published_at as string,
				).getTime();
				const nextDate = new Date(articles[i].published_at as string).getTime();
				expect(currentDate).toBeGreaterThanOrEqual(nextDate);
			}
		} catch (error) {
			console.error("ArticleAggregator error:", error);
			throw error;
		}
	}, 30000);

	it("should get latest articles without external sources", async () => {
		try {
			const articles = await ArticleAggregator.getLatestArticles({
				limit: 5,
				includeExternal: false,
			});

			console.log(`Found ${articles.length} internal articles only`);

			const externalArticles = articles.filter((article) => article.isExternal);
			expect(externalArticles.length).toBe(0);

			articles.forEach((article, index) => {
				console.log(`${index + 1}. [Ghost] ${article.title}`);
				expect(article.isExternal).toBe(false);
			});
		} catch (error) {
			console.error("ArticleAggregator error (internal only):", error);
			throw error;
		}
	}, 30000);

	it("should get featured articles", async () => {
		try {
			const articles = await ArticleAggregator.getFeaturedArticles({
				limit: 3,
			});

			console.log(`Found ${articles.length} featured articles`);

			articles.forEach((article, index) => {
				console.log(`${index + 1}. [Featured] ${article.title}`);
				expect(article.isExternal).toBe(false);
			});
		} catch (error) {
			console.error("ArticleAggregator featured articles error:", error);
			throw error;
		}
	}, 30000);
});
