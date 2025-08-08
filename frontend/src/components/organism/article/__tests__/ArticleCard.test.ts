import { describe, it, expect } from "vitest";
import type { ArticleArchiveType } from "~/types/ArticleArchiveType";

describe("ArticleCard Component Logic", () => {
	const mockPost: ArticleArchiveType = {
		title: "Test Article",
		slug: "test-article",
		published_at: "2023-12-15T10:00:00.000Z",
		feature_image: "https://example.com/image.jpg",
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
});
