import { describe, it, expect } from "vitest";
import { ArticleAggregator } from "./libs/articleAggregator";
import { CONFIG } from "./libs/config";

describe("Archive Integration Test", () => {
	it("should successfully fetch articles for archive page including RSS", async () => {
		console.log("CONFIG.externalBlogs:", CONFIG.externalBlogs);
		
		// Test the same logic used in ArchiveArticleList.astro
		const allArticles = await ArticleAggregator.getLatestArticles({
			limit: 100, // Archive page limit
			includeExternal: true,
		});
		
		console.log(`\nTotal articles fetched: ${allArticles.length}`);
		
		// Filter articles from last 6 months (same as ArchiveArticleList.astro)
		const sixMonthsAgo = new Date();
		sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
		
		const recentArticles = allArticles.filter(article => {
			const articleDate = new Date(article.published_at as string);
			return articleDate >= sixMonthsAgo;
		});
		
		console.log(`Articles from last 6 months: ${recentArticles.length}`);
		
		const internalArticles = recentArticles.filter(article => !article.isExternal);
		const externalArticles = recentArticles.filter(article => article.isExternal);
		
		console.log(`Internal (Ghost) articles: ${internalArticles.length}`);
		console.log(`External (RSS) articles: ${externalArticles.length}`);
		
		// Test the grouping logic used in ArchiveArticleList.astro
		const groupedPosts: { [key: string]: any[] } = {};
		recentArticles.forEach((article) => {
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
		
		const monthKeys = Object.keys(groupedPosts).sort((a, b) => b.localeCompare(a));
		
		console.log(`\nGrouped by months: ${monthKeys.length} months`);
		monthKeys.forEach(monthKey => {
			const monthPosts = groupedPosts[monthKey];
			const internal = monthPosts.filter(p => !p.isExternal).length;
			const external = monthPosts.filter(p => p.isExternal).length;
			console.log(`  ${monthKey}: ${monthPosts.length} articles (${internal} Ghost, ${external} RSS)`);
		});
		
		// Assertions
		expect(Array.isArray(allArticles)).toBe(true);
		expect(recentArticles.length).toBeGreaterThan(0);
		
		if (CONFIG.externalBlogs.length > 0) {
			// Should have some external articles if RSS feeds are configured
			console.log("\nChecking for RSS articles...");
			expect(externalArticles.length).toBeGreaterThan(0);
			
			// Check external articles structure
			externalArticles.forEach(article => {
				expect(article.isExternal).toBe(true);
				expect(article.source).toBeDefined();
				expect(article.externalUrl).toBeDefined();
			});
			
			const qiitaArticles = externalArticles.filter(a => a.source === "Qiita");
			const zennArticles = externalArticles.filter(a => a.source === "Zenn");
			
			console.log(`  Qiita articles: ${qiitaArticles.length}`);
			console.log(`  Zenn articles: ${zennArticles.length}`);
			
			if (qiitaArticles.length > 0) {
				console.log(`  First Qiita: "${qiitaArticles[0].title}"`);
			}
			if (zennArticles.length > 0) {
				console.log(`  First Zenn: "${zennArticles[0].title}"`);
			}
		}
		
		expect(monthKeys.length).toBeGreaterThan(0);
		expect(Object.keys(groupedPosts).every(key => groupedPosts[key].length > 0)).toBe(true);
	}, 30000);

	it("should test archive API endpoint logic", async () => {
		console.log("\n=== Testing Archive API Logic ===");
		
		// Test what the /api/archive endpoint does
		const allArticles = await ArticleAggregator.getLatestArticles({
			limit: 200, // Archive API limit
			includeExternal: true,
		});
		
		// Test date range filtering (offset = 0, so current 6 months)
		const offset = 0;
		const startDate = new Date();
		startDate.setMonth(startDate.getMonth() - offset - 6);
		const endDate = new Date();
		endDate.setMonth(endDate.getMonth() - offset);
		
		const filteredPosts = allArticles.filter(article => {
			const articleDate = new Date(article.published_at as string);
			return articleDate >= startDate && articleDate < endDate;
		});
		
		console.log(`Archive API would return: ${filteredPosts.length} articles`);
		
		const apiExternal = filteredPosts.filter(a => a.isExternal);
		const apiInternal = filteredPosts.filter(a => !a.isExternal);
		
		console.log(`  Internal: ${apiInternal.length}, External: ${apiExternal.length}`);
		
		expect(Array.isArray(filteredPosts)).toBe(true);
		
		if (CONFIG.externalBlogs.length > 0 && filteredPosts.length > 0) {
			// If we have external blogs configured and some articles, we might have external ones
			const hasExternal = apiExternal.length > 0;
			console.log(`  Has external articles: ${hasExternal}`);
		}
	}, 30000);
});