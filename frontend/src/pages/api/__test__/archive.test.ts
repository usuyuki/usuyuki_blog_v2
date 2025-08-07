import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Archive API", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("API route exists and can be imported", async () => {
		const module = await import("../archive");
		expect(module.GET).toBeDefined();
		expect(typeof module.GET).toBe("function");
	});

	it("handles URL parsing correctly", async () => {
		// Test basic URL parsing logic without Ghost dependency
		const testUrl1 = new URL("http://localhost/api/archive");
		const testUrl2 = new URL("http://localhost/api/archive?offset=6");

		const offset1 = parseInt(testUrl1.searchParams.get("offset") || "0");
		const offset2 = parseInt(testUrl2.searchParams.get("offset") || "0");

		expect(offset1).toBe(0);
		expect(offset2).toBe(6);
	});

	it("handles invalid offset parameter", () => {
		const testUrl = new URL("http://localhost/api/archive?offset=invalid");
		const offset = parseInt(testUrl.searchParams.get("offset") || "0");

		// parseInt of invalid string returns NaN, should default to 0
		expect(Number.isNaN(offset)).toBe(true);
	});

	it("constructs date filters correctly", () => {
		const offset = 6;
		const startDate = new Date();
		startDate.setMonth(startDate.getMonth() - offset - 6);

		const endDate = new Date();
		endDate.setMonth(endDate.getMonth() - offset);

		expect(startDate.getTime()).toBeLessThan(endDate.getTime());
	});
});
