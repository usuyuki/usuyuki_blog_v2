import { describe, it, expect, vi } from "vitest";
import { ArticleAggregator } from "./libs/articleAggregator";

describe("Load More Posts Issue Debug", () => {
	it("should demonstrate the issue with offset-based pagination", async () => {
		console.log("=== Testing Archive API offset behavior ===");
		
		// Test what happens when we request different offsets
		const testOffsets = [0, 6, 12, 18];
		
		for (const offset of testOffsets) {
			console.log(`\nTesting offset=${offset}`);
			
			// This simulates what the current archive API does
			const startDate = new Date();
			startDate.setMonth(startDate.getMonth() - offset - 6);
			
			const endDate = new Date();
			endDate.setMonth(endDate.getMonth() - offset);
			
			console.log(`  Date range: ${startDate.toISOString().slice(0, 10)} to ${endDate.toISOString().slice(0, 10)}`);
			
			// Get all articles (this is the problem - we always get the same set)
			const allArticles = await ArticleAggregator.getLatestArticles({
				limit: 200,
				includeExternal: true,
			});
			
			// Filter by date range
			const filteredPosts = allArticles.filter(article => {
				const articleDate = new Date(article.published_at as string);
				return articleDate >= startDate && articleDate < endDate;
			});
			
			console.log(`  Articles found: ${filteredPosts.length}`);
			
			if (filteredPosts.length > 0) {
				const firstArticle = filteredPosts[0];
				const lastArticle = filteredPosts[filteredPosts.length - 1];
				console.log(`    First: "${firstArticle.title}" (${new Date(firstArticle.published_at as string).toISOString().slice(0, 10)})`);
				console.log(`    Last: "${lastArticle.title}" (${new Date(lastArticle.published_at as string).toISOString().slice(0, 10)})`);
			}
		}
	}, 30000);

	it("should show the limitation of ArticleAggregator for old articles", async () => {
		console.log("\n=== Testing ArticleAggregator date limitations ===");
		
		const allArticles = await ArticleAggregator.getLatestArticles({
			limit: 200,
			includeExternal: true,
		});
		
		console.log(`Total articles from ArticleAggregator: ${allArticles.length}`);
		
		if (allArticles.length > 0) {
			const dates = allArticles.map(a => new Date(a.published_at as string));
			const oldestDate = new Date(Math.min(...dates.map(d => d.getTime())));
			const newestDate = new Date(Math.max(...dates.map(d => d.getTime())));
			
			console.log(`  Oldest article: ${oldestDate.toISOString().slice(0, 10)}`);
			console.log(`  Newest article: ${newestDate.toISOString().slice(0, 10)}`);
			
			// Check how many months back we can go
			const now = new Date();
			const monthsBack = Math.floor((now.getTime() - oldestDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
			console.log(`  Can access articles from ~${monthsBack} months ago`);
			
			// Test what happens when we request articles older than what we have
			const veryOldDate = new Date();
			veryOldDate.setMonth(veryOldDate.getMonth() - 24); // 2 years ago
			
			const veryOldArticles = allArticles.filter(article => {
				const articleDate = new Date(article.published_at as string);
				return articleDate < veryOldDate;
			});
			
			console.log(`  Articles older than 24 months: ${veryOldArticles.length}`);
		}
	}, 30000);

	it("should test the expected behavior for load more", () => {
		console.log("\n=== Expected Load More Behavior ===");
		
		// This is what should happen:
		// offset=0: Show months 0-5 (current to 6 months ago)
		// offset=6: Show months 6-11 (6 to 12 months ago) 
		// offset=12: Show months 12-17 (12 to 18 months ago)
		
		const currentDate = new Date();
		const testCases = [
			{ offset: 0, expectedMonthsAgo: [0, 6] },
			{ offset: 6, expectedMonthsAgo: [6, 12] },
			{ offset: 12, expectedMonthsAgo: [12, 18] },
		];
		
		testCases.forEach(({ offset, expectedMonthsAgo }) => {
			const startDate = new Date();
			startDate.setMonth(startDate.getMonth() - offset - 6);
			
			const endDate = new Date();
			endDate.setMonth(endDate.getMonth() - offset);
			
			const startMonthsAgo = Math.floor((currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
			const endMonthsAgo = Math.floor((currentDate.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
			
			console.log(`offset=${offset}: Should show ${endMonthsAgo}-${startMonthsAgo} months ago`);
			console.log(`  Date range: ${startDate.toISOString().slice(0, 10)} to ${endDate.toISOString().slice(0, 10)}`);
		});
	});
});