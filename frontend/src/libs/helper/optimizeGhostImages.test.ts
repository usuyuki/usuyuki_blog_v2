import { describe, it, expect } from "vitest";
import {
	optimizeGhostImageUrl,
	getResponsiveImageSizes,
} from "./optimizeGhostImages";

describe("optimizeGhostImageUrl", () => {
	it("should select best Ghost size for target dimensions", () => {
		const originalUrl =
			"https://blogapi.usuyuki.net/content/images/2023/03/IMG202-scaled.jpg";
		const dimensions = { width: 400, height: 300 };

		const result = optimizeGhostImageUrl(originalUrl, dimensions);

		expect(result).toBe(
			"https://blogapi.usuyuki.net/content/images/size/w600/2023/03/IMG202-scaled.jpg",
		);
	});

	it("should use w300 for small images (minimum size)", () => {
		const originalUrl =
			"https://blogapi.usuyuki.net/content/images/2023/03/IMG202-scaled.jpg";
		const dimensions = { width: 200, height: 200 };

		const result = optimizeGhostImageUrl(originalUrl, dimensions);

		expect(result).toBe(
			"https://blogapi.usuyuki.net/content/images/size/w300/2023/03/IMG202-scaled.jpg",
		);
	});

	it("should replace existing size parameter with best match", () => {
		const originalUrl =
			"https://blogapi.usuyuki.net/content/images/size/w2000/2023/03/IMG202-scaled.jpg";
		const dimensions = { width: 160, height: 160 };

		const result = optimizeGhostImageUrl(originalUrl, dimensions);

		expect(result).toBe(
			"https://blogapi.usuyuki.net/content/images/size/w300/2023/03/IMG202-scaled.jpg",
		);
	});

	it("should handle non-Ghost URLs by returning original", () => {
		const originalUrl = "https://example.com/image.jpg";
		const dimensions = { width: 400, height: 300 };

		const result = optimizeGhostImageUrl(originalUrl, dimensions);

		expect(result).toBe(originalUrl);
	});

	it("should handle empty URL", () => {
		const result = optimizeGhostImageUrl("", { width: 400, height: 300 });
		expect(result).toBe("");
	});

	it("should use largest size for oversized requests", () => {
		const originalUrl =
			"https://blogapi.usuyuki.net/content/images/2023/03/IMG202-scaled.jpg";
		const dimensions = { width: 3000, height: 2000 };

		const result = optimizeGhostImageUrl(originalUrl, dimensions);

		expect(result).toBe(
			"https://blogapi.usuyuki.net/content/images/size/w2400/2023/03/IMG202-scaled.jpg",
		);
	});
});

describe("getResponsiveImageSizes", () => {
	it("should generate responsive sizes maintaining aspect ratio", () => {
		const sizes = getResponsiveImageSizes(1600, 1200);

		expect(sizes.small.width).toBe(400);
		expect(sizes.small.height).toBe(300);
		expect(sizes.medium.width).toBe(800);
		expect(sizes.medium.height).toBe(600);
		expect(sizes.large.width).toBe(1200);
		expect(sizes.large.height).toBe(900);
	});

	it("should not exceed original dimensions", () => {
		const sizes = getResponsiveImageSizes(500, 400);

		expect(sizes.small.width).toBe(400);
		expect(sizes.medium.width).toBe(500);
		expect(sizes.large.width).toBe(500);
	});
});
