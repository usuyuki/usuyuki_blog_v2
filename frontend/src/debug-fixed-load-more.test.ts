import { describe, it, expect } from "vitest";
import { ArticleAggregator } from "./libs/articleAggregator";

describe("Fixed Load More Posts Test", () => {
	it("should test the new pagination-based approach", async () => {
		console.log("=== Testing New Pagination Approach ===");
		
		// Get all articles (simulating what the API does)
		const allArticles = await ArticleAggregator.getLatestArticles({
			limit: 200,
			includeExternal: true,
		});
		
		// Sort by date (newest first)
		const sortedArticles = allArticles.sort((a, b) => {
			const dateA = new Date(a.published_at as string).getTime();
			const dateB = new Date(b.published_at as string).getTime();
			return dateB - dateA;
		});
		
		console.log(`Total articles available: ${sortedArticles.length}`);
		
		// Test pagination
		const articlesPerPage = 12;
		const totalPages = Math.ceil(sortedArticles.length / articlesPerPage);
		
		console.log(`Articles per page: ${articlesPerPage}`);
		console.log(`Total pages: ${totalPages}`);
		
		// Test each page
		for (let page = 0; page < Math.min(totalPages, 5); page++) {
			const startIndex = page * articlesPerPage;
			const endIndex = startIndex + articlesPerPage;
			const paginatedPosts = sortedArticles.slice(startIndex, endIndex);
			const hasMore = endIndex < sortedArticles.length;
			
			console.log(`\nPage ${page}:`);
			console.log(`  Index range: ${startIndex}-${endIndex}`);
			console.log(`  Articles returned: ${paginatedPosts.length}`);
			console.log(`  Has more: ${hasMore}`);
			
			if (paginatedPosts.length > 0) {
				const firstArticle = paginatedPosts[0];
				const lastArticle = paginatedPosts[paginatedPosts.length - 1];
				console.log(`  First: "${firstArticle.title.slice(0, 50)}..." (${new Date(firstArticle.published_at as string).toISOString().slice(0, 10)})`);
				console.log(`  Last: "${lastArticle.title.slice(0, 50)}..." (${new Date(lastArticle.published_at as string).toISOString().slice(0, 10)})`);
				
				// Count internal vs external
				const internal = paginatedPosts.filter(p => !p.isExternal).length;
				const external = paginatedPosts.filter(p => p.isExternal).length;
				console.log(`  Internal: ${internal}, External: ${external}`);
			}
		}
		
		// Verify that each page returns different articles
		const page0 = sortedArticles.slice(0, articlesPerPage);
		const page1 = sortedArticles.slice(articlesPerPage, articlesPerPage * 2);
		
		if (page0.length > 0 && page1.length > 0) {
			const page0Titles = new Set(page0.map(p => p.title));
			const page1Titles = new Set(page1.map(p => p.title));
			const overlap = [...page0Titles].filter(title => page1Titles.has(title));
			
			console.log(`\nOverlap between page 0 and 1: ${overlap.length} articles`);
			expect(overlap.length).toBe(0); // Should be no overlap
		}
		
		expect(sortedArticles.length).toBeGreaterThan(0);
		if (sortedArticles.length > articlesPerPage) {
			expect(page1.length).toBeGreaterThan(0);
		}
	}, 30000);

	it("should test grouping logic for mixed article types", () => {
		console.log("\n=== Testing Grouping Logic ===");
		
		// Mock articles with mixed date formats (like what comes from API)
		const mockArticles = [
			{
				title: "Ghost Article 1",
				published_at: "2025-03-15T10:00:00.000Z", 
				slug: "ghost-1",
				isExternal: false
			},
			{
				title: "Qiita Article",
				published_at: "2025-03-10T08:00:00.000Z",
				slug: "https://qiita.com/test",
				source: "Qiita",
				isExternal: true,
				externalUrl: "https://qiita.com/test"
			},
			{
				title: "Ghost Article 2", 
				published_at: "2025-02-20T15:00:00.000Z",
				slug: "ghost-2",
				isExternal: false
			},
			{
				title: "Zenn Article",
				published_at: "2025-02-15T12:00:00.000Z",
				slug: "https://zenn.dev/test",
				source: "Zenn", 
				isExternal: true,
				externalUrl: "https://zenn.dev/test"
			}
		];

		// Test the grouping logic used in loadMorePosts
		const groupedPosts: { [key: string]: any[] } = {};

		mockArticles.forEach((post) => {
			let dateToUse: Date;
			if (typeof post.published_at === "string") {
				dateToUse = new Date(post.published_at);
			} else {
				// Handle DateType format if needed
				dateToUse = new Date(post.published_at);
			}
			
			const monthKey = `${dateToUse.getFullYear()}-${String(dateToUse.getMonth() + 1).padStart(2, "0")}`;
			if (!groupedPosts[monthKey]) {
				groupedPosts[monthKey] = [];
			}
			groupedPosts[monthKey].push(post);
		});

		const monthKeys = Object.keys(groupedPosts).sort((a, b) => b.localeCompare(a));
		
		console.log(`Grouped into ${monthKeys.length} months: ${monthKeys.join(', ')}`);
		
		monthKeys.forEach(monthKey => {
			const monthPosts = groupedPosts[monthKey];
			const internal = monthPosts.filter(p => !p.isExternal).length;
			const external = monthPosts.filter(p => p.isExternal).length;
			console.log(`  ${monthKey}: ${monthPosts.length} articles (${internal} Ghost, ${external} RSS)`);
		});

		expect(groupedPosts["2025-03"]).toHaveLength(2); // Ghost + Qiita
		expect(groupedPosts["2025-02"]).toHaveLength(2); // Ghost + Zenn
		expect(monthKeys[0]).toBe("2025-03"); // Should be sorted newest first
	});

	it("should simulate API response format", async () => {
		console.log("\n=== Testing API Response Format ===");
		
		const allArticles = await ArticleAggregator.getLatestArticles({
			limit: 200,
			includeExternal: true,
		});
		
		const sortedArticles = allArticles.sort((a, b) => {
			const dateA = new Date(a.published_at as string).getTime();
			const dateB = new Date(b.published_at as string).getTime();
			return dateB - dateA;
		});
		
		// Simulate API response for page 0
		const articlesPerPage = 12;
		const page = 0;
		const startIndex = page * articlesPerPage;
		const endIndex = startIndex + articlesPerPage;
		const paginatedPosts = sortedArticles.slice(startIndex, endIndex);
		
		const apiResponse = {
			posts: paginatedPosts,
			hasMore: endIndex < sortedArticles.length,
			totalArticles: sortedArticles.length,
			currentPage: page
		};
		
		console.log("API Response:");
		console.log(`  Posts: ${apiResponse.posts.length}`);
		console.log(`  Has more: ${apiResponse.hasMore}`);
		console.log(`  Total articles: ${apiResponse.totalArticles}`);
		console.log(`  Current page: ${apiResponse.currentPage}`);
		
		expect(apiResponse.posts.length).toBeGreaterThan(0);
		expect(typeof apiResponse.hasMore).toBe("boolean");
		expect(apiResponse.totalArticles).toBe(sortedArticles.length);
	}, 30000);
});