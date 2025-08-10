import { describe, it, expect } from "vitest";
import type { RSSItem, RSSFeed, ExternalBlogConfig } from "../RSSType";

describe("RSSType Type Definitions", () => {
	describe("RSSItem", () => {
		it("should have required fields", () => {
			const rssItem: RSSItem = {
				title: "Test Article",
				link: "https://example.com/article",
				published_at: "2023-12-15T10:00:00.000Z",
			};

			expect(rssItem.title).toBe("Test Article");
			expect(rssItem.link).toBe("https://example.com/article");
			expect(rssItem.published_at).toBe("2023-12-15T10:00:00.000Z");
		});

		it("should allow optional fields", () => {
			const rssItemWithOptional: RSSItem = {
				title: "Test Article",
				link: "https://example.com/article",
				published_at: "2023-12-15T10:00:00.000Z",
				description: "Test description",
				author: "Test Author",
				source: "Test Blog",
			};

			expect(rssItemWithOptional.description).toBe("Test description");
			expect(rssItemWithOptional.author).toBe("Test Author");
			expect(rssItemWithOptional.source).toBe("Test Blog");
		});

		it("should work without optional fields", () => {
			const rssItemMinimal: RSSItem = {
				title: "Minimal Article",
				link: "https://example.com/minimal",
				published_at: "2023-12-15T10:00:00.000Z",
			};

			expect(rssItemMinimal.description).toBeUndefined();
			expect(rssItemMinimal.author).toBeUndefined();
			expect(rssItemMinimal.source).toBeUndefined();
		});

		it("should validate string types for required fields", () => {
			const rssItem: RSSItem = {
				title: "Test Article",
				link: "https://example.com/article",
				published_at: "2023-12-15T10:00:00.000Z",
			};

			expect(typeof rssItem.title).toBe("string");
			expect(typeof rssItem.link).toBe("string");
			expect(typeof rssItem.published_at).toBe("string");
		});
	});

	describe("RSSFeed", () => {
		it("should have required fields", () => {
			const rssFeed: RSSFeed = {
				title: "Test Feed",
				link: "https://example.com",
				items: [],
			};

			expect(rssFeed.title).toBe("Test Feed");
			expect(rssFeed.link).toBe("https://example.com");
			expect(Array.isArray(rssFeed.items)).toBe(true);
			expect(rssFeed.items).toHaveLength(0);
		});

		it("should allow optional description", () => {
			const rssFeedWithDescription: RSSFeed = {
				title: "Test Feed",
				link: "https://example.com",
				description: "Test feed description",
				items: [],
			};

			expect(rssFeedWithDescription.description).toBe("Test feed description");
		});

		it("should contain array of RSSItems", () => {
			const rssItem: RSSItem = {
				title: "Test Article",
				link: "https://example.com/article",
				published_at: "2023-12-15T10:00:00.000Z",
			};

			const rssFeed: RSSFeed = {
				title: "Test Feed",
				link: "https://example.com",
				items: [rssItem],
			};

			expect(rssFeed.items).toHaveLength(1);
			expect(rssFeed.items[0]).toEqual(rssItem);
		});

		it("should work without optional description", () => {
			const rssFeed: RSSFeed = {
				title: "Minimal Feed",
				link: "https://example.com",
				items: [],
			};

			expect(rssFeed.description).toBeUndefined();
		});
	});

	describe("ExternalBlogConfig", () => {
		it("should have required fields", () => {
			const config: ExternalBlogConfig = {
				name: "Test Blog",
				rssUrl: "https://example.com/feed.xml",
			};

			expect(config.name).toBe("Test Blog");
			expect(config.rssUrl).toBe("https://example.com/feed.xml");
		});

		it("should validate string types", () => {
			const config: ExternalBlogConfig = {
				name: "Test Blog",
				rssUrl: "https://example.com/feed.xml",
			};

			expect(typeof config.name).toBe("string");
			expect(typeof config.rssUrl).toBe("string");
		});

		it("should work with different blog configurations", () => {
			const configs: ExternalBlogConfig[] = [
				{
					name: "Tech Blog",
					rssUrl: "https://techblog.com/feed.xml",
				},
				{
					name: "Personal Blog",
					rssUrl: "https://personal.blog/rss",
				},
			];

			expect(configs).toHaveLength(2);
			expect(configs[0].name).toBe("Tech Blog");
			expect(configs[1].name).toBe("Personal Blog");
		});
	});

	describe("Type compatibility with ArticleArchiveType", () => {
		it("should be compatible when converting RSSItem to ArticleArchiveType", () => {
			const rssItem: RSSItem = {
				title: "RSS Article",
				link: "https://external.com/article",
				published_at: "2023-12-15T10:00:00.000Z",
				source: "External Blog",
			};

			// This simulates the conversion logic in ArticleAggregator
			const convertedArticle = {
				slug: rssItem.link,
				published_at: rssItem.published_at,
				title: rssItem.title,
				source: rssItem.source,
				isExternal: true,
				externalUrl: rssItem.link,
			};

			expect(convertedArticle.slug).toBe(rssItem.link);
			expect(convertedArticle.title).toBe(rssItem.title);
			expect(convertedArticle.published_at).toBe(rssItem.published_at);
			expect(convertedArticle.source).toBe(rssItem.source);
			expect(convertedArticle.isExternal).toBe(true);
		});
	});
});
