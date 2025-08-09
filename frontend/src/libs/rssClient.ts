import type { RSSFeed, RSSItem, ExternalBlogConfig } from "~/types/RSSType";
// @ts-ignore
import { DOMParser } from "xmldom";

export class RSSClient {
	private static parseXML(xmlText: string): Document {
		const parser = new DOMParser();
		return parser.parseFromString(xmlText, "application/xml");
	}

	private static extractTextContent(element: any): string {
		return element?.textContent?.trim() || element?.nodeValue?.trim() || "";
	}

	private static getElementsByTagName(doc: any, tagName: string): any[] {
		const elements = doc.getElementsByTagName(tagName);
		return Array.from(elements);
	}

	private static getFirstElementByTagName(parent: any, tagName: string): any {
		const elements = parent.getElementsByTagName(tagName);
		return elements.length > 0 ? elements[0] : null;
	}

	private static parseRSSFeed(xmlDoc: any, sourceName: string): RSSFeed {
		const channels = this.getElementsByTagName(xmlDoc, "channel");
		const channel = channels.length > 0 ? channels[0] : null;
		const items = this.getElementsByTagName(xmlDoc, "item");

		const feedTitle = this.extractTextContent(
			this.getFirstElementByTagName(channel, "title"),
		);
		const feedLink = this.extractTextContent(
			this.getFirstElementByTagName(channel, "link"),
		);
		const feedDescription = this.extractTextContent(
			this.getFirstElementByTagName(channel, "description"),
		);

		const rssItems: RSSItem[] = items.map((item: any) => {
			const title = this.extractTextContent(
				this.getFirstElementByTagName(item, "title"),
			);
			const link = this.extractTextContent(
				this.getFirstElementByTagName(item, "link"),
			);
			const description = this.extractTextContent(
				this.getFirstElementByTagName(item, "description"),
			);
			const author = this.extractTextContent(
				this.getFirstElementByTagName(item, "author") ||
					this.getFirstElementByTagName(item, "dc:creator"),
			);

			// 日付の取得 (複数のフォーマットに対応)
			const pubDate =
				this.extractTextContent(
					this.getFirstElementByTagName(item, "pubDate"),
				) ||
				this.extractTextContent(
					this.getFirstElementByTagName(item, "dc:date"),
				) ||
				this.extractTextContent(
					this.getFirstElementByTagName(item, "published"),
				);

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

	private static parseAtomFeed(xmlDoc: any, sourceName: string): RSSFeed {
		const feeds = this.getElementsByTagName(xmlDoc, "feed");
		const feed = feeds.length > 0 ? feeds[0] : null;
		const entries = this.getElementsByTagName(xmlDoc, "entry");

		const feedTitle = this.extractTextContent(
			this.getFirstElementByTagName(feed, "title"),
		);
		const feedLinkElement = this.getFirstElementByTagName(feed, "link");
		const feedLink = feedLinkElement?.getAttribute("href") || "";
		const feedSubtitle = this.extractTextContent(
			this.getFirstElementByTagName(feed, "subtitle"),
		);

		const rssItems: RSSItem[] = entries.map((entry: any) => {
			const title = this.extractTextContent(
				this.getFirstElementByTagName(entry, "title"),
			);
			const linkElement = this.getFirstElementByTagName(entry, "link");
			const urlElement = this.getFirstElementByTagName(entry, "url");
			const link =
				linkElement?.getAttribute("href") ||
				this.extractTextContent(urlElement) ||
				"";
			const summaryElement = this.getFirstElementByTagName(entry, "summary");
			const contentElement = this.getFirstElementByTagName(entry, "content");
			const summary =
				this.extractTextContent(summaryElement) ||
				this.extractTextContent(contentElement) ||
				"";
			const authorElement = this.getFirstElementByTagName(entry, "author");
			const author = this.extractTextContent(
				this.getFirstElementByTagName(authorElement, "name"),
			);
			const published = this.extractTextContent(
				this.getFirstElementByTagName(entry, "published") ||
					this.getFirstElementByTagName(entry, "updated"),
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

	static async fetchRSS(config: ExternalBlogConfig): Promise<RSSFeed | null> {
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
			const xmlDoc = this.parseXML(xmlText);

			// XMLパースエラーチェック
			const parseErrors = this.getElementsByTagName(xmlDoc, "parsererror");
			if (parseErrors.length > 0) {
				console.error(
					`RSS parse error for ${config.name}:`,
					this.extractTextContent(parseErrors[0]),
				);
				return null;
			}

			// RSS 2.0 または RSS 1.0 の場合
			const rssElements = this.getElementsByTagName(xmlDoc, "rss");
			const rdfElements = this.getElementsByTagName(xmlDoc, "rdf:RDF");
			if (rssElements.length > 0 || rdfElements.length > 0) {
				return this.parseRSSFeed(xmlDoc, config.name);
			}
			// Atom フィードの場合
			const feedElements = this.getElementsByTagName(xmlDoc, "feed");
			if (feedElements.length > 0) {
				return this.parseAtomFeed(xmlDoc, config.name);
			} else {
				console.error(`Unknown feed format for ${config.name}`);
				return null;
			}
		} catch (error) {
			console.error(`RSS fetch error for ${config.name}:`, error);
			return null;
		}
	}

	static async fetchMultipleRSS(
		configs: ExternalBlogConfig[],
	): Promise<RSSItem[]> {
		const promises = configs.map((config) => this.fetchRSS(config));
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
}
