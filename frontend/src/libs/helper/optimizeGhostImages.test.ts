import { describe, it, expect } from "vitest";
import {
	optimizeGhostImageUrl,
	getResponsiveImageSizes,
} from "./optimizeGhostImages";

describe("optimizeGhostImageUrl", () => {
	it("should return original URL as Ghost doesn't support URL parameters", () => {
		const originalUrl =
			"https://blogapi.usuyuki.net/content/images/2023/03/IMG202-scaled.jpg";
		const dimensions = { width: 400, height: 300 };

		const result = optimizeGhostImageUrl(originalUrl, dimensions);

		expect(result).toBe(originalUrl);
	});

	it("should handle empty URL", () => {
		const result = optimizeGhostImageUrl("", { width: 400, height: 300 });
		expect(result).toBe("");
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
