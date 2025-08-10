import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ExternalBlogConfig } from "~/types/RSSType";

// Mock xmldom
vi.mock("xmldom", () => ({
	DOMParser: vi.fn().mockImplementation(() => ({
		parseFromString: vi.fn(),
	})),
}));

// Mock cache module
vi.mock("~/libs/cache", () => {
	const mockCache = {
		get: vi.fn(),
		set: vi.fn(),
		clear: vi.fn(),
		delete: vi.fn(),
		cleanup: vi.fn(),
	};

	return {
		cache: mockCache,
		ONE_HOUR_MS: 60 * 60 * 1000,
	};
});

// Mock fetch
global.fetch = vi.fn();

import { fetchRSS, fetchMultipleRSS } from "../rssClient";
import { cache } from "../cache";

describe("RSSClient", () => {
	const mockConfig: ExternalBlogConfig = {
		name: "Test Blog",
		rssUrl: "https://example.com/feed.xml",
	};

	const mockRSSXML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
	<channel>
		<title>Test Blog</title>
		<link>https://example.com</link>
		<description>Test RSS Feed</description>
		<item>
			<title>Test Article</title>
			<link>https://example.com/article</link>
			<description>Test article description</description>
			<author>Test Author</author>
			<pubDate>Wed, 15 Dec 2023 10:00:00 +0000</pubDate>
		</item>
	</channel>
</rss>`;

	beforeEach(() => {
		vi.clearAllMocks();
		// Reset cache mock to return null by default (cache miss)
		vi.mocked(cache.get).mockReturnValue(null);
	});

	describe("fetchRSS", () => {
		it("should fetch and parse RSS feed successfully", async () => {
			// Mock fetch response
			vi.mocked(global.fetch).mockResolvedValue({
				ok: true,
				text: async () => mockRSSXML,
			} as Response);

			// Mock XML parsing - create a mock DOM structure
			const mockXmlDoc = {
				getElementsByTagName: vi.fn((tagName: string) => {
					if (tagName === "parsererror") return [];
					if (tagName === "rss") return [{}];
					if (tagName === "channel")
						return [
							{
								getElementsByTagName: (tag: string) => {
									if (tag === "title") return [{ textContent: "Test Blog" }];
									if (tag === "link")
										return [{ textContent: "https://example.com" }];
									if (tag === "description")
										return [{ textContent: "Test RSS Feed" }];
									return [];
								},
							},
						];
					if (tagName === "item")
						return [
							{
								getElementsByTagName: (tag: string) => {
									if (tag === "title") return [{ textContent: "Test Article" }];
									if (tag === "link")
										return [{ textContent: "https://example.com/article" }];
									if (tag === "description")
										return [{ textContent: "Test article description" }];
									if (tag === "author") return [{ textContent: "Test Author" }];
									if (tag === "pubDate")
										return [{ textContent: "Wed, 15 Dec 2023 10:00:00 +0000" }];
									return [];
								},
							},
						];
					return [];
				}),
			};

			const mockParser = {
				parseFromString: vi.fn().mockReturnValue(mockXmlDoc),
			};

			// Mock the DOMParser constructor
			const { DOMParser } = await import("xmldom");
			vi.mocked(DOMParser).mockImplementation(() => mockParser);

			const result = await fetchRSS(mockConfig);

			expect(global.fetch).toHaveBeenCalledWith(
				mockConfig.rssUrl,
				expect.objectContaining({
					headers: {
						"User-Agent": "Mozilla/5.0 (compatible; RSS Reader)",
					},
				}),
			);

			expect(result).not.toBeNull();
			expect(result?.title).toBe("Test Blog");
			expect(result?.items).toHaveLength(1);
			expect(result?.items[0].title).toBe("Test Article");
			expect(result?.items[0].source).toBe("Test Blog");
		});

		it("should handle fetch errors gracefully", async () => {
			vi.mocked(global.fetch).mockResolvedValue({
				ok: false,
				status: 404,
				statusText: "Not Found",
			} as Response);

			const result = await fetchRSS(mockConfig);

			expect(result).toBeNull();
		});

		it("should handle network errors gracefully", async () => {
			vi.mocked(global.fetch).mockRejectedValue(new Error("Network error"));

			const result = await fetchRSS(mockConfig);

			expect(result).toBeNull();
		});

		it("should handle XML parse errors gracefully", async () => {
			vi.mocked(global.fetch).mockResolvedValue({
				ok: true,
				text: async () => "invalid xml",
			} as Response);

			const mockXmlDoc = {
				getElementsByTagName: vi.fn((tagName: string) => {
					if (tagName === "parsererror")
						return [{ textContent: "Parse error" }];
					return [];
				}),
			};

			const mockParser = {
				parseFromString: vi.fn().mockReturnValue(mockXmlDoc),
			};

			const { DOMParser } = await import("xmldom");
			vi.mocked(DOMParser).mockImplementation(() => mockParser);

			const result = await fetchRSS(mockConfig);

			expect(result).toBeNull();
		});

		it("should handle unknown feed formats gracefully", async () => {
			vi.mocked(global.fetch).mockResolvedValue({
				ok: true,
				text: async () => "<unknownformat></unknownformat>",
			} as Response);

			const mockXmlDoc = {
				getElementsByTagName: vi.fn((tagName: string) => {
					if (tagName === "parsererror") return [];
					if (tagName === "rss") return [];
					if (tagName === "rdf:RDF") return [];
					if (tagName === "feed") return [];
					return [];
				}),
			};

			const mockParser = {
				parseFromString: vi.fn().mockReturnValue(mockXmlDoc),
			};

			const { DOMParser } = await import("xmldom");
			vi.mocked(DOMParser).mockImplementation(() => mockParser);

			const result = await fetchRSS(mockConfig);

			expect(result).toBeNull();
		});
	});

	describe("fetchMultipleRSS", () => {
		it("should fetch multiple RSS feeds and merge them", async () => {
			const configs = [
				{ name: "Blog 1", rssUrl: "https://blog1.com/feed.xml" },
				{ name: "Blog 2", rssUrl: "https://blog2.com/feed.xml" },
			];

			// Mock successful fetch for both feeds
			vi.mocked(global.fetch)
				.mockResolvedValueOnce({
					ok: true,
					text: async () => mockRSSXML,
				} as Response)
				.mockResolvedValueOnce({
					ok: true,
					text: async () =>
						mockRSSXML.replace("Test Article", "Test Article 2"),
				} as Response);

			// Mock XML parsing
			const mockXmlDoc = {
				getElementsByTagName: vi.fn((tagName: string) => {
					if (tagName === "parsererror") return [];
					if (tagName === "rss") return [{}];
					if (tagName === "channel")
						return [
							{
								getElementsByTagName: (tag: string) => {
									if (tag === "title") return [{ textContent: "Test Blog" }];
									if (tag === "link")
										return [{ textContent: "https://example.com" }];
									if (tag === "description")
										return [{ textContent: "Test RSS Feed" }];
									return [];
								},
							},
						];
					if (tagName === "item")
						return [
							{
								getElementsByTagName: (tag: string) => {
									if (tag === "title") return [{ textContent: "Test Article" }];
									if (tag === "link")
										return [{ textContent: "https://example.com/article" }];
									if (tag === "description")
										return [{ textContent: "Test article description" }];
									if (tag === "author") return [{ textContent: "Test Author" }];
									if (tag === "pubDate")
										return [{ textContent: "Wed, 15 Dec 2023 10:00:00 +0000" }];
									return [];
								},
							},
						];
					return [];
				}),
			};

			const mockParser = {
				parseFromString: vi.fn().mockReturnValue(mockXmlDoc),
			};

			const { DOMParser } = await import("xmldom");
			vi.mocked(DOMParser).mockImplementation(() => mockParser);

			const result = await fetchMultipleRSS(configs);

			expect(result).toHaveLength(2);
			expect(result[0].source).toBe("Blog 1");
			expect(result[1].source).toBe("Blog 2");
		});

		it("should handle partial failures in multiple feeds", async () => {
			const configs = [
				{ name: "Blog 1", rssUrl: "https://blog1.com/feed.xml" },
				{ name: "Blog 2", rssUrl: "https://blog2.com/feed.xml" },
			];

			// Mock one successful and one failed fetch
			vi.mocked(global.fetch)
				.mockResolvedValueOnce({
					ok: true,
					text: async () => mockRSSXML,
				} as Response)
				.mockResolvedValueOnce({
					ok: false,
					status: 500,
					statusText: "Server Error",
				} as Response);

			// Mock XML parsing for successful fetch
			const mockXmlDoc = {
				getElementsByTagName: vi.fn((tagName: string) => {
					if (tagName === "parsererror") return [];
					if (tagName === "rss") return [{}];
					if (tagName === "channel")
						return [
							{
								getElementsByTagName: (tag: string) => {
									if (tag === "title") return [{ textContent: "Test Blog" }];
									if (tag === "link")
										return [{ textContent: "https://example.com" }];
									if (tag === "description")
										return [{ textContent: "Test RSS Feed" }];
									return [];
								},
							},
						];
					if (tagName === "item")
						return [
							{
								getElementsByTagName: (tag: string) => {
									if (tag === "title") return [{ textContent: "Test Article" }];
									if (tag === "link")
										return [{ textContent: "https://example.com/article" }];
									if (tag === "description")
										return [{ textContent: "Test article description" }];
									if (tag === "author") return [{ textContent: "Test Author" }];
									if (tag === "pubDate")
										return [{ textContent: "Wed, 15 Dec 2023 10:00:00 +0000" }];
									return [];
								},
							},
						];
					return [];
				}),
			};

			const mockParser = {
				parseFromString: vi.fn().mockReturnValue(mockXmlDoc),
			};

			const { DOMParser } = await import("xmldom");
			vi.mocked(DOMParser).mockImplementation(() => mockParser);

			const result = await fetchMultipleRSS(configs);

			// Should still return successful feed
			expect(result).toHaveLength(1);
			expect(result[0].source).toBe("Blog 1");
		});

		it("should sort items by published date in descending order", async () => {
			const configs = [
				{ name: "Blog 1", rssUrl: "https://blog1.com/feed.xml" },
			];

			// Mock fetch response
			vi.mocked(global.fetch).mockResolvedValue({
				ok: true,
				text: async () => mockRSSXML,
			} as Response);

			// Mock XML parsing with multiple items of different dates
			const mockXmlDoc = {
				getElementsByTagName: vi.fn((tagName: string) => {
					if (tagName === "parsererror") return [];
					if (tagName === "rss") return [{}];
					if (tagName === "channel")
						return [
							{
								getElementsByTagName: (tag: string) => {
									if (tag === "title") return [{ textContent: "Test Blog" }];
									if (tag === "link")
										return [{ textContent: "https://example.com" }];
									if (tag === "description")
										return [{ textContent: "Test RSS Feed" }];
									return [];
								},
							},
						];
					if (tagName === "item")
						return [
							{
								getElementsByTagName: (tag: string) => {
									if (tag === "title")
										return [{ textContent: "Older Article" }];
									if (tag === "link")
										return [{ textContent: "https://example.com/older" }];
									if (tag === "description")
										return [{ textContent: "Older article" }];
									if (tag === "author") return [{ textContent: "Test Author" }];
									if (tag === "pubDate")
										return [{ textContent: "Wed, 10 Dec 2023 10:00:00 +0000" }];
									return [];
								},
							},
							{
								getElementsByTagName: (tag: string) => {
									if (tag === "title")
										return [{ textContent: "Newer Article" }];
									if (tag === "link")
										return [{ textContent: "https://example.com/newer" }];
									if (tag === "description")
										return [{ textContent: "Newer article" }];
									if (tag === "author") return [{ textContent: "Test Author" }];
									if (tag === "pubDate")
										return [{ textContent: "Wed, 20 Dec 2023 10:00:00 +0000" }];
									return [];
								},
							},
						];
					return [];
				}),
			};

			const mockParser = {
				parseFromString: vi.fn().mockReturnValue(mockXmlDoc),
			};

			const { DOMParser } = await import("xmldom");
			vi.mocked(DOMParser).mockImplementation(() => mockParser);

			const result = await fetchMultipleRSS(configs);

			expect(result).toHaveLength(2);
			expect(result[0].title).toBe("Newer Article"); // Should be first (newer date)
			expect(result[1].title).toBe("Older Article"); // Should be second (older date)
		});

		it("should handle empty configs array", async () => {
			const result = await fetchMultipleRSS([]);

			expect(result).toHaveLength(0);
		});
	});
});
