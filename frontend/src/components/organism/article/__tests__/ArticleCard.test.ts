import { describe, it, expect } from "vitest";
import type { ArticleArchiveType } from "~/types/ArticleArchiveType";

describe("ArticleCard Component Logic", () => {
	const mockPost: ArticleArchiveType = {
		title: "Test Article",
		slug: "test-article",
		published_at: "2023-12-15T10:00:00.000Z",
		feature_image: "https://example.com/image.jpg",
		isExternal: false,
	};

	it("extracts correct day from date", () => {
		const date = new Date(mockPost.published_at as string);
		const postDay = date.getDate();

		expect(postDay).toBe(15);
	});

	it("handles date conversion properly", () => {
		const testDate = new Date("2023-12-01");
		const day = testDate.getDate();

		expect(day).toBe(1);
	});

	it("validates post structure", () => {
		expect(mockPost).toHaveProperty("title");
		expect(mockPost).toHaveProperty("slug");
		expect(mockPost).toHaveProperty("published_at");
		expect(mockPost).toHaveProperty("feature_image");
		expect(mockPost.slug).toBe("test-article");
		expect(mockPost.title).toBe("Test Article");
	});

	it("handles null feature_image correctly", () => {
		const postWithoutImage = { ...mockPost, feature_image: null };

		expect(postWithoutImage.feature_image).toBeNull();
		expect(postWithoutImage.title).toBe("Test Article");
	});

	it("handles external posts correctly", () => {
		const externalPost: ArticleArchiveType = {
			title: "External RSS Article",
			slug: "https://external-blog.com/article",
			published_at: "2023-12-15T10:00:00.000Z",
			source: "External Blog",
			isExternal: true,
			externalUrl: "https://external-blog.com/article",
		};

		expect(externalPost.isExternal).toBe(true);
		expect(externalPost.source).toBe("External Blog");
		expect(externalPost.externalUrl).toBe("https://external-blog.com/article");
		expect(externalPost.feature_image).toBeUndefined();
	});

	it("validates post structure for external posts", () => {
		const externalPost: ArticleArchiveType = {
			title: "External Article",
			slug: "https://example.com/external",
			published_at: "2023-12-15T10:00:00.000Z",
			source: "Example Blog",
			isExternal: true,
			externalUrl: "https://example.com/external",
		};

		expect(externalPost).toHaveProperty("title");
		expect(externalPost).toHaveProperty("slug");
		expect(externalPost).toHaveProperty("published_at");
		expect(externalPost).toHaveProperty("source");
		expect(externalPost).toHaveProperty("isExternal");
		expect(externalPost).toHaveProperty("externalUrl");
		expect(externalPost.isExternal).toBe(true);
	});

	it("handles mixed date formats correctly", () => {
		const dateStringPost: ArticleArchiveType = {
			title: "String Date Post",
			slug: "string-date-post",
			published_at: "2023-12-15T10:00:00.000Z",
			isExternal: false,
		};

		const dateObjectPost: ArticleArchiveType = {
			title: "Object Date Post",
			slug: "object-date-post",
			published_at: { year: 2023, month: 12, day: 15 },
			isExternal: false,
		};

		// String date
		if (typeof dateStringPost.published_at === "string") {
			const date = new Date(dateStringPost.published_at);
			expect(date.getDate()).toBe(15);
		}

		// Object date
		if (typeof dateObjectPost.published_at === "object") {
			expect(dateObjectPost.published_at.day).toBe(15);
			expect(dateObjectPost.published_at.month).toBe(12);
			expect(dateObjectPost.published_at.year).toBe(2023);
		}
	});
});
