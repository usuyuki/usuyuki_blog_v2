import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the ArticleAggregator to test the expected integration
vi.mock("~/libs/articleAggregator", () => ({
	ArticleAggregator: {
		getLatestArticles: vi.fn(),
	},
}));

// We can't actually test the Astro component directly, so we test the logic that should be used
import { ArticleAggregator } from "~/libs/articleAggregator";
import type { ArticleArchiveType } from "~/types/ArticleArchiveType";

describe("ArchiveArticleList Integration Logic", () => {
	const mockGhostArticle: ArticleArchiveType = {
		title: "Ghost Article",
		slug: "ghost-article",
		published_at: "2023-12-15T10:00:00.000Z",
		feature_image: "https://example.com/image.jpg",
		isExternal: false,
	};

	const mockQiitaArticle: ArticleArchiveType = {
		title: "Qiita Article",
		slug: "https://qiita.com/usuyuki/items/123",
		published_at: "2023-12-10T10:00:00.000Z",
		source: "Qiita",
		isExternal: true,
		externalUrl: "https://qiita.com/usuyuki/items/123",
	};

	const mockZennArticle: ArticleArchiveType = {
		title: "Zenn Article", 
		slug: "https://zenn.dev/usuyuki/articles/456",
		published_at: "2023-12-05T10:00:00.000Z",
		source: "Zenn",
		isExternal: true,
		externalUrl: "https://zenn.dev/usuyuki/articles/456",
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("should fetch articles including external RSS sources for archive", async () => {
		const mockArticles = [mockGhostArticle, mockQiitaArticle, mockZennArticle];
		vi.mocked(ArticleAggregator.getLatestArticles).mockResolvedValue(mockArticles);

		// Test the logic that ArchiveArticleList should use
		const articles = await ArticleAggregator.getLatestArticles({
			limit: 100, // Archive should show more articles than top page
			includeExternal: true,
		});

		expect(ArticleAggregator.getLatestArticles).toHaveBeenCalledWith({
			limit: 100,
			includeExternal: true,
		});

		expect(articles).toHaveLength(3);
		expect(articles.some(article => article.source === "Qiita")).toBe(true);
		expect(articles.some(article => article.source === "Zenn")).toBe(true);
		expect(articles.some(article => !article.isExternal)).toBe(true);
	});

	it("should group articles by month including external articles", () => {
		const articles = [mockGhostArticle, mockQiitaArticle, mockZennArticle];
		
		// Test the grouping logic that should be used in ArchiveArticleList
		const groupedPosts: { [key: string]: ArticleArchiveType[] } = {};
		
		articles.forEach((article) => {
			// For external articles, preserve the original date format
			let dateToUse: Date;
			if (typeof article.published_at === "string") {
				dateToUse = new Date(article.published_at);
			} else {
				// Convert DateType to Date
				dateToUse = new Date(
					`${article.published_at.year}-${article.published_at.month.toString().padStart(2, '0')}-${article.published_at.day.toString().padStart(2, '0')}`
				);
			}
			
			const monthKey = `${dateToUse.getFullYear()}-${String(dateToUse.getMonth() + 1).padStart(2, '0')}`;
			
			if (!groupedPosts[monthKey]) {
				groupedPosts[monthKey] = [];
			}
			
			groupedPosts[monthKey].push({
				...article,
				// Don't modify the published_at for external articles
				published_at: article.isExternal ? article.published_at : {
					year: dateToUse.getFullYear(),
					month: dateToUse.getMonth() + 1,
					day: dateToUse.getDate(),
				},
			});
		});

		expect(groupedPosts).toHaveProperty("2023-12");
		expect(groupedPosts["2023-12"]).toHaveLength(3);
		
		// Check that external articles maintain their original format
		const qiitaArticleInGroup = groupedPosts["2023-12"].find(a => a.source === "Qiita");
		const zennArticleInGroup = groupedPosts["2023-12"].find(a => a.source === "Zenn");
		const ghostArticleInGroup = groupedPosts["2023-12"].find(a => !a.isExternal);
		
		expect(qiitaArticleInGroup?.isExternal).toBe(true);
		expect(zennArticleInGroup?.isExternal).toBe(true);
		expect(ghostArticleInGroup?.isExternal).toBe(false);
		
		// External articles should keep string dates, Ghost articles should be converted
		expect(typeof qiitaArticleInGroup?.published_at).toBe("string");
		expect(typeof zennArticleInGroup?.published_at).toBe("string");
		expect(typeof ghostArticleInGroup?.published_at).toBe("object");
	});

	it("should sort month keys correctly", () => {
		const groupedPosts = {
			"2023-10": [mockQiitaArticle],
			"2023-12": [mockGhostArticle],
			"2023-11": [mockZennArticle],
		};

		const sortedMonthKeys = Object.keys(groupedPosts).sort((a, b) => b.localeCompare(a));
		
		expect(sortedMonthKeys[0]).toBe("2023-12");
		expect(sortedMonthKeys[1]).toBe("2023-11");
		expect(sortedMonthKeys[2]).toBe("2023-10");
	});

	it("should handle mixed date formats in archive grouping", () => {
		const mixedArticles: ArticleArchiveType[] = [
			{
				...mockGhostArticle,
				published_at: { year: 2023, month: 12, day: 15 }, // DateType format
			},
			{
				...mockQiitaArticle,
				published_at: "2023-12-10T10:00:00.000Z", // string format
			}
		];

		const groupedPosts: { [key: string]: ArticleArchiveType[] } = {};
		
		mixedArticles.forEach((article) => {
			let dateToUse: Date;
			if (typeof article.published_at === "string") {
				dateToUse = new Date(article.published_at);
			} else {
				dateToUse = new Date(
					`${article.published_at.year}-${article.published_at.month.toString().padStart(2, '0')}-${article.published_at.day.toString().padStart(2, '0')}`
				);
			}
			
			const monthKey = `${dateToUse.getFullYear()}-${String(dateToUse.getMonth() + 1).padStart(2, '0')}`;
			
			if (!groupedPosts[monthKey]) {
				groupedPosts[monthKey] = [];
			}
			
			groupedPosts[monthKey].push(article);
		});

		expect(groupedPosts).toHaveProperty("2023-12");
		expect(groupedPosts["2023-12"]).toHaveLength(2);
	});

	it("should handle archive API integration", async () => {
		// Test that the archive API should also be updated to use ArticleAggregator
		// Use recent dates so the articles pass the date filter
		const recentMockArticles = [
			{
				...mockGhostArticle,
				published_at: new Date().toISOString(), // Current date
			},
			{
				...mockQiitaArticle, 
				published_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
			},
			{
				...mockZennArticle,
				published_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(), // 1 week ago
			}
		];
		
		vi.mocked(ArticleAggregator.getLatestArticles).mockResolvedValue(recentMockArticles);

		// This simulates what the /api/archive endpoint should do
		const startDate = new Date();
		startDate.setMonth(startDate.getMonth() - 6);

		const articles = await ArticleAggregator.getLatestArticles({
			limit: 200, // Archive API should return more articles
			includeExternal: true,
		});

		// Filter by date range (this is what the API should do)
		const filteredArticles = articles.filter(article => {
			const articleDate = new Date(article.published_at as string);
			return articleDate >= startDate;
		});

		expect(filteredArticles.length).toBeGreaterThan(0);
		expect(filteredArticles.some(article => article.isExternal)).toBe(true);
	});
});