import { describe, it, expect } from "vitest";
import { isSlug } from "../isSlug";

describe("isSlug", () => {
	it("should respect 100 character limit", () => {
		expect(isSlug("a".repeat(100))).toBe(true);
		expect(isSlug("a".repeat(101))).toBe(false);
	});

	it("should accept valid slugs", () => {
		expect(isSlug("programming")).toBe(true);
		expect(isSlug("conference-study")).toBe(true);
		expect(isSlug("php")).toBe(true);
		expect(isSlug("ui_shig")).toBe(true);
		expect(isSlug("test123")).toBe(true);
	});

	it("should reject null/undefined/empty/invalid", () => {
		expect(isSlug("")).toBe(false);
		expect(isSlug("undefined")).toBe(false);
		expect(isSlug(undefined)).toBe(false);
		expect(isSlug("test:invalid")).toBe(false);
		expect(isSlug("test.invalid")).toBe(false);
		expect(isSlug("test=invalid")).toBe(false);
		expect(isSlug("_invalid")).toBe(false);
		expect(isSlug("assets")).toBe(false);
	});

	it("should reject URLs and URL-encoded strings", () => {
		expect(
			isSlug(
				"https://blogapi.usuyuki.net/content/images/size/w600/wordpress/2021/05/computer_folder.png",
			),
		).toBe(false);
		expect(
			isSlug("https:%2F%2Fblogapi.usuyuki.net%2Fcontent%2Fimages%2F&w=480"),
		).toBe(false);
		expect(isSlug("http://example.com")).toBe(false);
		expect(isSlug("test%2Fpath")).toBe(false);
	});
});
