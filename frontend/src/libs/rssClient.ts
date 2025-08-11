import type { RSSFeed, RSSItem, ExternalBlogConfig } from "~/types/RSSType";
import { cache, ONE_HOUR_MS } from "~/libs/cache";

function parseXML(xmlText: string): Document {
	const parser = new DOMParser();
	return parser.parseFromString(xmlText, "application/xml");
}

function extractTextContent(element: Element | null): string {
	const node = element as Node | null;
	return element?.textContent?.trim() || node?.nodeValue?.trim() || "";
}

function getElementsByTagName(doc: Document, tagName: string): Element[] {
	const elements = doc.getElementsByTagName(tagName);
	return Array.from(elements);
}

function getFirstElementByTagName(
	parent: Element | Document | null,
	tagName: string,
): Element | null {
	if (!parent) return null;
	const elements = parent.getElementsByTagName(tagName);
	return elements.length > 0 ? elements[0] : null;
}

function parseRSSFeed(xmlDoc: Document, sourceName: string): RSSFeed {
	const channels = getElementsByTagName(xmlDoc, "channel");
	const channel = channels.length > 0 ? channels[0] : null;
	const items = getElementsByTagName(xmlDoc, "item");

	const feedTitle = extractTextContent(
		getFirstElementByTagName(channel, "title"),
	);
	const feedLink = extractTextContent(
		getFirstElementByTagName(channel, "link"),
	);
	const feedDescription = extractTextContent(
		getFirstElementByTagName(channel, "description"),
	);

	const rssItems: RSSItem[] = items.map((item: Element) => {
		const title = extractTextContent(getFirstElementByTagName(item, "title"));
		const link = extractTextContent(getFirstElementByTagName(item, "link"));
		const description = extractTextContent(
			getFirstElementByTagName(item, "description"),
		);
		const author = extractTextContent(
			getFirstElementByTagName(item, "author") ||
				getFirstElementByTagName(item, "dc:creator"),
		);

		// 日付の取得 (複数のフォーマットに対応)
		const pubDate =
			extractTextContent(getFirstElementByTagName(item, "pubDate")) ||
			extractTextContent(getFirstElementByTagName(item, "dc:date")) ||
			extractTextContent(getFirstElementByTagName(item, "published"));

		return {
			title,
			link,
			published_at: pubDate,
			description,
			author,
			source: sourceName,
		};
	});

	return {
		title: feedTitle,
		link: feedLink,
		description: feedDescription,
		items: rssItems,
	};
}

function parseAtomFeed(xmlDoc: Document, sourceName: string): RSSFeed {
	const feeds = getElementsByTagName(xmlDoc, "feed");
	const feed = feeds.length > 0 ? feeds[0] : null;
	const entries = getElementsByTagName(xmlDoc, "entry");

	const feedTitle = extractTextContent(getFirstElementByTagName(feed, "title"));
	const feedLinkElement = getFirstElementByTagName(feed, "link");
	const feedLink = feedLinkElement?.getAttribute("href") || "";
	const feedSubtitle = extractTextContent(
		getFirstElementByTagName(feed, "subtitle"),
	);

	const rssItems: RSSItem[] = entries.map((entry: Element) => {
		const title = extractTextContent(getFirstElementByTagName(entry, "title"));
		const linkElement = getFirstElementByTagName(entry, "link");
		const urlElement = getFirstElementByTagName(entry, "url");
		const link =
			linkElement?.getAttribute("href") || extractTextContent(urlElement) || "";
		const summaryElement = getFirstElementByTagName(entry, "summary");
		const contentElement = getFirstElementByTagName(entry, "content");
		const summary =
			extractTextContent(summaryElement) ||
			extractTextContent(contentElement) ||
			"";
		const authorElement = getFirstElementByTagName(entry, "author");
		const author = extractTextContent(
			getFirstElementByTagName(authorElement, "name"),
		);
		const published = extractTextContent(
			getFirstElementByTagName(entry, "published") ||
				getFirstElementByTagName(entry, "updated"),
		);

		return {
			title,
			link,
			published_at: published,
			description: summary,
			author,
			source: sourceName,
		};
	});

	return {
		title: feedTitle,
		link: feedLink,
		description: feedSubtitle,
		items: rssItems,
	};
}

export async function fetchRSS(
	config: ExternalBlogConfig,
): Promise<RSSFeed | null> {
	const cacheKey = `rss:${config.rssUrl}`;

	// キャッシュから取得を試行
	const cachedFeed = cache.get<RSSFeed>(cacheKey);
	if (cachedFeed) {
		return cachedFeed;
	}

	try {
		const response = await fetch(config.rssUrl, {
			headers: {
				"User-Agent": "Mozilla/5.0 (compatible; RSS Reader)",
			},
		});

		if (!response.ok) {
			console.error(
				`RSS fetch failed for ${config.name}: ${response.status} ${response.statusText}`,
			);
			return null;
		}

		const xmlText = await response.text();
		const xmlDoc = parseXML(xmlText);

		// XMLパースエラーチェック
		const parseErrors = getElementsByTagName(xmlDoc, "parsererror");
		if (parseErrors.length > 0) {
			console.error(
				`RSS parse error for ${config.name}:`,
				extractTextContent(parseErrors[0]),
			);
			return null;
		}

		let feed: RSSFeed | null = null;

		// RSS 2.0 または RSS 1.0 の場合
		const rssElements = getElementsByTagName(xmlDoc, "rss");
		const rdfElements = getElementsByTagName(xmlDoc, "rdf:RDF");
		if (rssElements.length > 0 || rdfElements.length > 0) {
			feed = parseRSSFeed(xmlDoc, config.name);
		}
		// Atom フィードの場合
		else {
			const feedElements = getElementsByTagName(xmlDoc, "feed");
			if (feedElements.length > 0) {
				feed = parseAtomFeed(xmlDoc, config.name);
			} else {
				console.error(`Unknown feed format for ${config.name}`);
				return null;
			}
		}

		// 成功した場合はキャッシュに保存
		if (feed) {
			cache.set(cacheKey, feed, ONE_HOUR_MS);
		}

		return feed;
	} catch (error) {
		console.error(`RSS fetch error for ${config.name}:`, error);
		return null;
	}
}

export async function fetchMultipleRSS(
	configs: ExternalBlogConfig[],
): Promise<RSSItem[]> {
	const promises = configs.map((config) => fetchRSS(config));
	const results = await Promise.allSettled(promises);

	const allItems: RSSItem[] = [];

	results.forEach((result, index) => {
		if (result.status === "fulfilled" && result.value) {
			allItems.push(...result.value.items);
		} else {
			console.warn(`Failed to fetch RSS for ${configs[index].name}`);
		}
	});

	// 日付順でソート
	return allItems.sort((a, b) => {
		const dateA = new Date(a.published_at).getTime();
		const dateB = new Date(b.published_at).getTime();
		return dateB - dateA; // 新しい順
	});
}
