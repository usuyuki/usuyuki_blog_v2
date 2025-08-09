import { describe, it, expect, vi } from "vitest";
import { RSSClient } from "./libs/rssClient";
import { CONFIG } from "./libs/config";

// Test actual RSS fetching in development
describe("RSS Fetching Integration Test", () => {
	it("should load CONFIG correctly", () => {
		console.log("CONFIG.externalBlogs:", CONFIG.externalBlogs);
		expect(CONFIG.externalBlogs).toBeDefined();
		expect(Array.isArray(CONFIG.externalBlogs)).toBe(true);
	});

	it("should test actual RSS fetching for Qiita", async () => {
		const qiitaConfig = CONFIG.externalBlogs.find(
			(blog) => blog.name === "Qiita",
		);
		if (!qiitaConfig) {
			console.log("Qiita config not found, skipping test");
			return;
		}

		console.log(`Testing Qiita: ${qiitaConfig.rssUrl}`);

		try {
			const feed = await RSSClient.fetchRSS(qiitaConfig);
			console.log(
				"Qiita feed result:",
				feed ? `${feed.items.length} items` : "null",
			);

			if (feed && feed.items.length > 0) {
				console.log("First Qiita item:", {
					title: feed.items[0].title,
					published_at: feed.items[0].published_at,
					link: feed.items[0].link,
				});
			}
		} catch (error) {
			console.error("Qiita fetch error:", error);
		}
	}, 30000); // 30 second timeout

	it("should test actual RSS fetching for Zenn", async () => {
		const zennConfig = CONFIG.externalBlogs.find(
			(blog) => blog.name === "Zenn",
		);
		if (!zennConfig) {
			console.log("Zenn config not found, skipping test");
			return;
		}

		console.log(`Testing Zenn: ${zennConfig.rssUrl}`);

		try {
			const feed = await RSSClient.fetchRSS(zennConfig);
			console.log(
				"Zenn feed result:",
				feed ? `${feed.items.length} items` : "null",
			);

			if (feed && feed.items.length > 0) {
				console.log("First Zenn item:", {
					title: feed.items[0].title,
					published_at: feed.items[0].published_at,
					link: feed.items[0].link,
				});
			}
		} catch (error) {
			console.error("Zenn fetch error:", error);
		}
	}, 30000); // 30 second timeout

	it("should test fetchMultipleRSS", async () => {
		console.log("Testing fetchMultipleRSS with configs:", CONFIG.externalBlogs);

		try {
			const allItems = await RSSClient.fetchMultipleRSS(CONFIG.externalBlogs);
			console.log(`Combined RSS items: ${allItems.length}`);

			allItems.slice(0, 5).forEach((item, index) => {
				console.log(`${index + 1}. [${item.source}] ${item.title}`);
			});

			expect(Array.isArray(allItems)).toBe(true);
		} catch (error) {
			console.error("fetchMultipleRSS error:", error);
			throw error;
		}
	}, 30000); // 30 second timeout
});
