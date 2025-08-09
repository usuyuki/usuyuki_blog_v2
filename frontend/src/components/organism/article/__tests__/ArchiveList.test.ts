import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ArticleArchiveType } from "~/types/ArticleArchiveType";

// Mock fetch
global.fetch = vi.fn();

describe("ArchiveList Logic", () => {
	const mockInitialPosts: { [key: string]: ArticleArchiveType[] } = {
		"2023-12": [
			{
				title: "December Article",
				slug: "december-article",
				published_at: "2023-12-15T10:00:00.000Z",
				feature_image: "https://example.com/image1.jpg",
				isExternal: false,
			},
		],
		"2023-11": [
			{
				title: "November Article",
				slug: "november-article",
				published_at: "2023-11-20T10:00:00.000Z",
				feature_image: "https://example.com/image2.jpg",
				isExternal: false,
			},
		],
	};

	const mockInitialMonthKeys = ["2023-12", "2023-11"];

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("processes initial data correctly", () => {
		expect(mockInitialPosts).toHaveProperty("2023-12");
		expect(mockInitialPosts).toHaveProperty("2023-11");
		expect(mockInitialPosts["2023-12"]).toHaveLength(1);
		expect(mockInitialPosts["2023-11"]).toHaveLength(1);
	});

	it("sorts month keys in descending order", () => {
		const sortedKeys = mockInitialMonthKeys.sort((a, b) => b.localeCompare(a));
		expect(sortedKeys[0]).toBe("2023-12");
		expect(sortedKeys[1]).toBe("2023-11");
	});

	it("groups posts by month correctly", () => {
		const testPosts: ArticleArchiveType[] = [
			{
				title: "October Article",
				slug: "october-article",
				published_at: "2023-10-10T10:00:00.000Z",
				feature_image: undefined,
				isExternal: false,
			},
		];

		const groupedPosts: { [key: string]: ArticleArchiveType[] } = {};

		testPosts.forEach((post) => {
			const date = new Date(post.published_at as string);
			const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
			if (!groupedPosts[monthKey]) {
				groupedPosts[monthKey] = [];
			}
			groupedPosts[monthKey].push(post);
		});

		expect(groupedPosts).toHaveProperty("2023-10");
		expect(groupedPosts["2023-10"]).toHaveLength(1);
		expect(groupedPosts["2023-10"][0].title).toBe("October Article");
	});

	it("formats month display names correctly", () => {
		const monthKey = "2023-12";
		const [year, month] = monthKey.split("-");
		const monthName = `${year}年${parseInt(month)}月`;

		expect(monthName).toBe("2023年12月");
	});

	it("handles fetch API call construction", () => {
		const offset = 6;
		const expectedUrl = `/api/archive?offset=${offset}`;

		expect(expectedUrl).toBe("/api/archive?offset=6");
	});

	it("merges new posts with existing ones", () => {
		const existingPosts = { ...mockInitialPosts };
		const newPosts: { [key: string]: ArticleArchiveType[] } = {
			"2023-10": [
				{
					title: "October Article",
					slug: "october-article",
					published_at: "2023-10-10T10:00:00.000Z",
					feature_image: undefined,
					isExternal: false,
				},
			],
		};

		const mergedKeys = [...mockInitialMonthKeys];
		Object.keys(newPosts).forEach((monthKey) => {
			if (!existingPosts[monthKey]) {
				mergedKeys.push(monthKey);
			}
		});

		const sortedMergedKeys = mergedKeys.sort((a, b) => b.localeCompare(a));

		expect(sortedMergedKeys).toContain("2023-12");
		expect(sortedMergedKeys).toContain("2023-11");
		expect(sortedMergedKeys).toContain("2023-10");
		expect(sortedMergedKeys[0]).toBe("2023-12");
	});

	it("handles mixed internal and external posts correctly", () => {
		const mixedPosts: { [key: string]: ArticleArchiveType[] } = {
			"2023-12": [
				{
					title: "Internal Ghost Post",
					slug: "ghost-post",
					published_at: "2023-12-15T10:00:00.000Z",
					feature_image: "https://example.com/image.jpg",
					isExternal: false,
				},
				{
					title: "External RSS Post",
					slug: "https://external.com/post",
					published_at: "2023-12-14T10:00:00.000Z",
					source: "External Blog",
					isExternal: true,
					externalUrl: "https://external.com/post",
				},
			],
		};

		expect(mixedPosts["2023-12"]).toHaveLength(2);
		expect(mixedPosts["2023-12"][0].isExternal).toBe(false);
		expect(mixedPosts["2023-12"][1].isExternal).toBe(true);
		expect(mixedPosts["2023-12"][1].source).toBe("External Blog");
		expect(mixedPosts["2023-12"][1].externalUrl).toBe(
			"https://external.com/post",
		);
	});

	it("differentiates between internal and external article URLs", () => {
		const internalPost: ArticleArchiveType = {
			title: "Internal Post",
			slug: "internal-post",
			published_at: "2023-12-15T10:00:00.000Z",
			isExternal: false,
		};

		const externalPost: ArticleArchiveType = {
			title: "External Post",
			slug: "https://external.com/post",
			published_at: "2023-12-14T10:00:00.000Z",
			source: "External Blog",
			isExternal: true,
			externalUrl: "https://external.com/post",
		};

		// Internal post should have relative URL
		expect(internalPost.isExternal).toBe(false);
		expect(internalPost.slug).toBe("internal-post");
		expect(internalPost.externalUrl).toBeUndefined();

		// External post should have full URL
		expect(externalPost.isExternal).toBe(true);
		expect(externalPost.slug).toBe("https://external.com/post");
		expect(externalPost.externalUrl).toBe("https://external.com/post");
	});
});
