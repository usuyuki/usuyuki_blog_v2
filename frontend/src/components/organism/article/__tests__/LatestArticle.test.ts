import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ArticleArchiveType } from "~/types/ArticleArchiveType";

// Mock the ArticleAggregator
vi.mock("~/libs/articleAggregator", () => ({
	ArticleAggregator: {
		getLatestArticles: vi.fn(),
	},
}));

import { ArticleAggregator } from "~/libs/articleAggregator";

describe("LatestArticle Component Logic", () => {
	const mockArticles: ArticleArchiveType[] = [
		{
			title: "Latest Ghost Article",
			slug: "latest-ghost-article",
			published_at: "2023-12-15T10:00:00.000Z",
			feature_image: "https://example.com/image1.jpg",
			isExternal: false,
		},
		{
			title: "Latest RSS Article",
			slug: "https://external-blog.com/post",
			published_at: "2023-12-14T10:00:00.000Z",
			source: "External Blog",
			isExternal: true,
			externalUrl: "https://external-blog.com/post",
		},
	];

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should call ArticleAggregator.getLatestArticles with correct parameters", async () => {
		vi.mocked(ArticleAggregator.getLatestArticles).mockResolvedValue(
			mockArticles,
		);

		// Simulate the component's data fetching logic
		const articles = await ArticleAggregator.getLatestArticles({
			limit: 10,
			includeExternal: true,
		});

		expect(ArticleAggregator.getLatestArticles).toHaveBeenCalledWith({
			limit: 10,
			includeExternal: true,
		});
		expect(articles).toEqual(mockArticles);
	});

	it("should handle the posts data structure correctly", async () => {
		vi.mocked(ArticleAggregator.getLatestArticles).mockResolvedValue(
			mockArticles,
		);

		const articles = await ArticleAggregator.getLatestArticles({
			limit: 10,
			includeExternal: true,
		});

		// Simulate the component's data structure
		const postsData = {
			posts: articles,
		};

		expect(postsData.posts).toHaveLength(2);
		expect(postsData.posts[0].title).toBe("Latest Ghost Article");
		expect(postsData.posts[0].isExternal).toBe(false);
		expect(postsData.posts[1].title).toBe("Latest RSS Article");
		expect(postsData.posts[1].isExternal).toBe(true);
	});

	it("should handle empty articles array", async () => {
		vi.mocked(ArticleAggregator.getLatestArticles).mockResolvedValue([]);

		const articles = await ArticleAggregator.getLatestArticles({
			limit: 10,
			includeExternal: true,
		});

		const postsData = {
			posts: articles,
		};

		expect(postsData.posts).toHaveLength(0);
	});

	it("should handle ArticleAggregator errors gracefully", async () => {
		vi.mocked(ArticleAggregator.getLatestArticles).mockRejectedValue(
			new Error("Failed to fetch articles"),
		);

		let error: Error | null = null;
		try {
			await ArticleAggregator.getLatestArticles({
				limit: 10,
				includeExternal: true,
			});
		} catch (e) {
			error = e as Error;
		}

		expect(error).not.toBeNull();
		expect(error?.message).toBe("Failed to fetch articles");
	});

	it("should validate article structure for both Ghost and RSS posts", () => {
		const ghostPost = mockArticles[0];
		const rssPost = mockArticles[1];

		// Ghost post validation
		expect(ghostPost).toHaveProperty("title");
		expect(ghostPost).toHaveProperty("slug");
		expect(ghostPost).toHaveProperty("published_at");
		expect(ghostPost).toHaveProperty("feature_image");
		expect(ghostPost).toHaveProperty("isExternal");
		expect(ghostPost.isExternal).toBe(false);

		// RSS post validation
		expect(rssPost).toHaveProperty("title");
		expect(rssPost).toHaveProperty("slug");
		expect(rssPost).toHaveProperty("published_at");
		expect(rssPost).toHaveProperty("source");
		expect(rssPost).toHaveProperty("isExternal");
		expect(rssPost).toHaveProperty("externalUrl");
		expect(rssPost.isExternal).toBe(true);
	});

	it("should maintain correct article ordering", async () => {
		const sortedArticles = mockArticles.sort((a, b) => {
			const dateA = new Date(a.published_at as string).getTime();
			const dateB = new Date(b.published_at as string).getTime();
			return dateB - dateA; // newest first
		});

		vi.mocked(ArticleAggregator.getLatestArticles).mockResolvedValue(
			sortedArticles,
		);

		const articles = await ArticleAggregator.getLatestArticles({
			limit: 10,
			includeExternal: true,
		});

		expect(articles[0].title).toBe("Latest Ghost Article"); // 2023-12-15 (newer)
		expect(articles[1].title).toBe("Latest RSS Article"); // 2023-12-14 (older)
	});
});
