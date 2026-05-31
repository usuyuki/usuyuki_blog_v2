import { describe, it, expect } from "vitest";
import { isSlug } from "../isSlug";

describe("isSlug", () => {
  it("should respect 191 character limit", () => {
    expect(isSlug("a".repeat(191))).toBe(true);
    expect(isSlug("a".repeat(192))).toBe(false);
  });

  it("should accept long Japanese-encoded slugs", () => {
    // Ghost CMS が日本語タイトルを UTF-8 hex に変換した例（141文字）
    expect(
      isSlug(
        "vtuber-e3-82-92-e8-a6-8b-e3-81-a6-e4-ba-ba-e7-94-9f-e3-81-ab-e5-bd-a9-e3-82-8a-e3-81-8c-e7-94-9f-e3-81-be-e3-82-8c-e3-81-be-e3-81-97-e3-81-9f",
      ),
    ).toBe(true);
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
