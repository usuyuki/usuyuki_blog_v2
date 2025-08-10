import { describe, it, expect, vi, beforeEach } from "vitest";
import type { RSSItem } from "~/types/RSSType";

// Mock the dependencies
vi.mock("~/libs/ghostClient", () => ({
	ghostApiWithRetry: {
		posts: {
			browse: vi.fn(),
		},
	},
}));

vi.mock("~/libs/rssClient", () => ({
	fetchMultipleRSS: vi.fn(),
}));

vi.mock("~/libs/config", () => ({
	CONFIG: {
		externalBlogs: [
			{ name: "Test Blog", rssUrl: "https://example.com/feed.xml" },
		],
	},
}));

import { getLatestArticles, getFeaturedArticles } from "../articleAggregator";
import { ghostApiWithRetry } from "~/libs/ghostClient";
import { fetchMultipleRSS } from "~/libs/rssClient";

describe("ArticleAggregator", () => {
	const mockGhostPost = {
		slug: "ghost-post",
		published_at: "2023-12-15T10:00:00.000Z",
		feature_image: "https://example.com/image.jpg",
		title: "Ghost Post Title",
	};

	const mockRSSItem: RSSItem = {
		title: "RSS Post Title",
		link: "https://external-blog.com/post",
		published_at: "2023-12-14T10:00:00.000Z",
		source: "Test Blog",
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("getLatestArticles", () => {
		it("should fetch and combine Ghost and RSS articles", async () => {
			// Mock Ghost API response
			vi.mocked(ghostApiWithRetry.posts.browse).mockResolvedValue([
				mockGhostPost,
			]);

			// Mock RSS Client response
			vi.mocked(fetchMultipleRSS).mockResolvedValue([mockRSSItem]);

			const articles = await getLatestArticles({
				limit: 10,
				includeExternal: true,
			});

			expect(articles).toHaveLength(2);
			// Should be sorted by date (Ghost post is newer)
			expect(articles[0].isExternal).toBe(false);
			expect(articles[1].isExternal).toBe(true);
			expect(articles[0].title).toBe("Ghost Post Title");
			expect(articles[1].title).toBe("RSS Post Title");

			// Check date formats are preserved
			expect(typeof articles[0].published_at).toBe("string");
			expect(typeof articles[1].published_at).toBe("string");
		});

		it("should handle Ghost API failure gracefully", async () => {
			// Mock Ghost API to throw error
			vi.mocked(ghostApiWithRetry.posts.browse).mockRejectedValue(
				new Error("Rate limit exceeded"),
			);

			// Mock RSS Client response
			vi.mocked(fetchMultipleRSS).mockResolvedValue([mockRSSItem]);

			const articles = await getLatestArticles({
				limit: 10,
				includeExternal: true,
			});

			expect(articles).toHaveLength(1);
			expect(articles[0].isExternal).toBe(true);
			expect(articles[0].title).toBe("RSS Post Title");
		});

		it("should exclude external articles when includeExternal is false", async () => {
			vi.mocked(ghostApiWithRetry.posts.browse).mockResolvedValue([
				mockGhostPost,
			]);

			const articles = await getLatestArticles({
				limit: 10,
				includeExternal: false,
			});

			expect(articles).toHaveLength(1);
			expect(articles[0].isExternal).toBe(false);
			expect(vi.mocked(fetchMultipleRSS)).not.toHaveBeenCalled();
		});

		it("should sort articles by published date (newest first)", async () => {
			const olderGhostPost = {
				...mockGhostPost,
				published_at: "2023-12-10T10:00:00.000Z",
				title: "Older Ghost Post",
			};

			const newerRSSItem: RSSItem = {
				...mockRSSItem,
				published_at: "2023-12-20T10:00:00.000Z",
				title: "Newer RSS Post",
			};

			vi.mocked(ghostApiWithRetry.posts.browse).mockResolvedValue([
				olderGhostPost,
			]);
			vi.mocked(fetchMultipleRSS).mockResolvedValue([newerRSSItem]);

			const articles = await getLatestArticles({
				limit: 10,
				includeExternal: true,
			});

			expect(articles[0].title).toBe("Newer RSS Post");
			expect(articles[1].title).toBe("Older Ghost Post");
		});

		it("should respect the limit parameter", async () => {
			const ghostPosts = Array.from({ length: 5 }, (_, i) => ({
				...mockGhostPost,
				slug: `ghost-post-${i}`,
				title: `Ghost Post ${i}`,
			}));

			vi.mocked(ghostApiWithRetry.posts.browse).mockResolvedValue(ghostPosts);
			vi.mocked(fetchMultipleRSS).mockResolvedValue([mockRSSItem]);

			const articles = await getLatestArticles({
				limit: 3,
				includeExternal: true,
			});

			expect(articles).toHaveLength(3);
		});

		it("should convert RSS items to articles correctly", async () => {
			vi.mocked(ghostApiWithRetry.posts.browse).mockResolvedValue([]);
			vi.mocked(fetchMultipleRSS).mockResolvedValue([mockRSSItem]);

			const articles = await getLatestArticles({
				limit: 10,
				includeExternal: true,
			});

			const rssArticle = articles[0];
			expect(rssArticle.slug).toBe(mockRSSItem.link);
			expect(rssArticle.published_at).toBe(mockRSSItem.published_at);
			expect(rssArticle.title).toBe(mockRSSItem.title);
			expect(rssArticle.source).toBe(mockRSSItem.source);
			expect(rssArticle.isExternal).toBe(true);
			expect(rssArticle.externalUrl).toBe(mockRSSItem.link);
		});

		it("should convert Ghost posts to articles correctly", async () => {
			vi.mocked(ghostApiWithRetry.posts.browse).mockResolvedValue([
				mockGhostPost,
			]);
			vi.mocked(fetchMultipleRSS).mockResolvedValue([]);

			const articles = await getLatestArticles({
				limit: 10,
				includeExternal: false,
			});

			const ghostArticle = articles[0];
			expect(ghostArticle.slug).toBe(mockGhostPost.slug);
			expect(ghostArticle.published_at).toBe(mockGhostPost.published_at);
			expect(ghostArticle.title).toBe(mockGhostPost.title);
			expect(ghostArticle.feature_image).toBe(mockGhostPost.feature_image);
			expect(ghostArticle.isExternal).toBe(false);
		});

		it("should handle mixed date formats in sorting correctly", async () => {
			// Create articles with different date formats
			const oldGhostPost = {
				...mockGhostPost,
				published_at: "2023-01-01T10:00:00.000Z",
				title: "Old Ghost Post",
			};

			const newRSSItem: RSSItem = {
				...mockRSSItem,
				published_at: "2023-12-31T10:00:00.000Z",
				title: "New RSS Post",
			};

			vi.mocked(ghostApiWithRetry.posts.browse).mockResolvedValue([
				oldGhostPost,
			]);
			vi.mocked(fetchMultipleRSS).mockResolvedValue([newRSSItem]);

			const articles = await getLatestArticles({
				limit: 10,
				includeExternal: true,
			});

			// Should be sorted correctly by date (newest first)
			expect(articles).toHaveLength(2);
			expect(articles[0].title).toBe("New RSS Post");
			expect(articles[1].title).toBe("Old Ghost Post");

			// Date formats should be preserved
			expect(typeof articles[0].published_at).toBe("string");
			expect(typeof articles[1].published_at).toBe("string");
		});

		it("should handle invalid dates gracefully", async () => {
			const invalidDateGhostPost = {
				...mockGhostPost,
				published_at: "invalid-date",
				title: "Invalid Date Post",
			};

			const validRSSItem: RSSItem = {
				...mockRSSItem,
				published_at: "2023-12-15T10:00:00.000Z",
				title: "Valid Date RSS Post",
			};

			vi.mocked(ghostApiWithRetry.posts.browse).mockResolvedValue([
				invalidDateGhostPost,
			]);
			vi.mocked(fetchMultipleRSS).mockResolvedValue([validRSSItem]);

			const articles = await getLatestArticles({
				limit: 10,
				includeExternal: true,
			});

			// Should still return articles, even with invalid dates
			expect(articles).toHaveLength(2);
			expect(articles.some((a) => a.title === "Invalid Date Post")).toBe(true);
			expect(articles.some((a) => a.title === "Valid Date RSS Post")).toBe(
				true,
			);
		});
	});

	describe("getFeaturedArticles", () => {
		it("should fetch featured Ghost articles only", async () => {
			const featuredPost = {
				...mockGhostPost,
				title: "Featured Post",
			};

			vi.mocked(ghostApiWithRetry.posts.browse).mockResolvedValue([
				featuredPost,
			]);

			const articles = await getFeaturedArticles({
				limit: 5,
			});

			expect(articles).toHaveLength(1);
			expect(articles[0].title).toBe("Featured Post");
			expect(articles[0].isExternal).toBe(false);

			expect(vi.mocked(ghostApiWithRetry.posts.browse)).toHaveBeenCalledWith({
				filter: "featured:true",
				order: "published_at DESC",
				limit: 5,
			});
		});

		it("should handle Ghost API failure for featured articles", async () => {
			vi.mocked(ghostApiWithRetry.posts.browse).mockRejectedValue(
				new Error("API Error"),
			);

			const articles = await getFeaturedArticles({
				limit: 5,
			});

			expect(articles).toHaveLength(0);
		});

		it("should return empty array when no featured posts", async () => {
			vi.mocked(ghostApiWithRetry.posts.browse).mockResolvedValue([]);

			const articles = await getFeaturedArticles({
				limit: 5,
			});

			expect(articles).toHaveLength(0);
		});
	});
});
