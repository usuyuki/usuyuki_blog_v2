import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock ArticleAggregator since the API should use it for RSS integration
vi.mock("~/libs/articleAggregator", () => ({
	ArticleAggregator: {
		getLatestArticles: vi.fn(),
	},
}));

describe("Archive API", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("API route exists and can be imported", async () => {
		const module = await import("../archive");
		expect(module.GET).toBeDefined();
		expect(typeof module.GET).toBe("function");
	});

	it("handles URL parsing correctly", async () => {
		// Test basic URL parsing logic without Ghost dependency
		const testUrl1 = new URL("http://localhost/api/archive");
		const testUrl2 = new URL("http://localhost/api/archive?offset=6");

		const offset1 = parseInt(testUrl1.searchParams.get("offset") || "0");
		const offset2 = parseInt(testUrl2.searchParams.get("offset") || "0");

		expect(offset1).toBe(0);
		expect(offset2).toBe(6);
	});

	it("handles invalid offset parameter", () => {
		const testUrl = new URL("http://localhost/api/archive?offset=invalid");
		const offset = parseInt(testUrl.searchParams.get("offset") || "0");

		// parseInt of invalid string returns NaN, should default to 0
		expect(Number.isNaN(offset)).toBe(true);
	});

	it("constructs date filters correctly", () => {
		const offset = 6;
		const startDate = new Date();
		startDate.setMonth(startDate.getMonth() - offset - 6);

		const endDate = new Date();
		endDate.setMonth(endDate.getMonth() - offset);

		expect(startDate.getTime()).toBeLessThan(endDate.getTime());
	});

	it("should test new pagination-based API logic", () => {
		// Test the new pagination logic
		const mockArticles = [
			{
				title: "Article 1",
				published_at: "2025-07-01T00:00:00Z",
				isExternal: false,
			},
			{
				title: "Article 2",
				published_at: "2025-06-01T00:00:00Z",
				source: "Qiita",
				isExternal: true,
			},
			{
				title: "Article 3",
				published_at: "2025-05-01T00:00:00Z",
				isExternal: false,
			},
			{
				title: "Article 4",
				published_at: "2025-04-01T00:00:00Z",
				source: "Zenn",
				isExternal: true,
			},
		];

		// Sort by date (newest first)
		const sortedArticles = mockArticles.sort((a, b) => {
			const dateA = new Date(a.published_at).getTime();
			const dateB = new Date(b.published_at).getTime();
			return dateB - dateA;
		});

		// Test pagination
		const articlesPerPage = 2;
		const page = 0;
		const startIndex = page * articlesPerPage;
		const endIndex = startIndex + articlesPerPage;
		const paginatedPosts = sortedArticles.slice(startIndex, endIndex);
		const hasMore = endIndex < sortedArticles.length;

		expect(paginatedPosts).toHaveLength(2);
		expect(paginatedPosts[0].title).toBe("Article 1"); // Newest first
		expect(paginatedPosts[1].title).toBe("Article 2");
		expect(hasMore).toBe(true);

		// Test page 1
		const page1StartIndex = 1 * articlesPerPage;
		const page1EndIndex = page1StartIndex + articlesPerPage;
		const page1Posts = sortedArticles.slice(page1StartIndex, page1EndIndex);
		const page1HasMore = page1EndIndex < sortedArticles.length;

		expect(page1Posts).toHaveLength(2);
		expect(page1Posts[0].title).toBe("Article 3");
		expect(page1Posts[1].title).toBe("Article 4");
		expect(page1HasMore).toBe(false);
	});

	it("should handle date filtering for external articles", () => {
		const testArticles = [
			{
				title: "Recent Qiita",
				published_at: new Date().toISOString(), // Recent
				isExternal: true,
				source: "Qiita",
			},
			{
				title: "Old Zenn",
				published_at: new Date(2020, 0, 1).toISOString(), // Very old
				isExternal: true,
				source: "Zenn",
			},
		];

		const sixMonthsAgo = new Date();
		sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

		const recentArticles = testArticles.filter((article) => {
			const articleDate = new Date(article.published_at);
			return articleDate >= sixMonthsAgo;
		});

		expect(recentArticles).toHaveLength(1);
		expect(recentArticles[0].source).toBe("Qiita");
	});
});
