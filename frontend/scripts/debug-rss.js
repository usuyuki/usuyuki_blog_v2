// Debug script to test RSS fetching
import { fetchRSS, fetchMultipleRSS } from "../src/libs/rssClient.js";
import { CONFIG } from "../src/libs/config.js";

console.log("=== RSS Fetching Debug ===");
console.log("CONFIG.externalBlogs:", CONFIG.externalBlogs);

async function testRSSFetching() {
	console.log("\n=== Testing individual RSS feeds ===");

	for (const config of CONFIG.externalBlogs) {
		console.log(`\nTesting ${config.name} (${config.rssUrl}):`);
		try {
			const feed = await fetchRSS(config);
			if (feed) {
				console.log(`✅ Success! Found ${feed.items.length} items`);
				console.log(`Feed title: ${feed.title}`);
				if (feed.items.length > 0) {
					console.log(`First item: ${feed.items[0].title}`);
					console.log(`Published: ${feed.items[0].published_at}`);
				}
			} else {
				console.log(`❌ Failed to fetch feed`);
			}
		} catch (error) {
			console.log(`❌ Error:`, error.message);
		}
	}

	console.log("\n=== Testing fetchMultipleRSS ===");
	try {
		const allItems = await fetchMultipleRSS(CONFIG.externalBlogs);
		console.log(`✅ Combined items: ${allItems.length}`);
		allItems.forEach((item, index) => {
			console.log(`${index + 1}. [${item.source}] ${item.title}`);
		});
	} catch (error) {
		console.log(`❌ Error in fetchMultipleRSS:`, error.message);
	}
}

testRSSFetching().catch(console.error);
