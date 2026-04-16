import { describe, it, expect } from "vitest";
import {
  buildTwitterShareUrl,
  buildHatenaBookmarkUrl,
  buildMisskeyShareUrl,
} from "./shareUrl";

describe("buildTwitterShareUrl", () => {
  it("タイトルとURLを含むツイートURLを生成する", () => {
    const result = buildTwitterShareUrl(
      "https://example.com/post",
      "テスト記事",
    );
    expect(result).toContain("https://twitter.com/intent/tweet?text=");
    expect(result).toContain(encodeURIComponent("テスト記事 | うすゆきブログ"));
    expect(result).toContain(encodeURIComponent("https://example.com/post"));
    expect(result).toContain(encodeURIComponent("#うすゆきブログ"));
  });

  it("特殊文字をエンコードする", () => {
    const result = buildTwitterShareUrl(
      "https://example.com/post?a=1&b=2",
      "タイトル & 記事",
    );
    expect(result).not.toContain(" ");
    expect(result).not.toContain("&b=2");
  });
});

describe("buildHatenaBookmarkUrl", () => {
  it("https URLからはてなブックマークURLを生成する", () => {
    const result = buildHatenaBookmarkUrl("https://example.com/post");
    expect(result).toBe("https://b.hatena.ne.jp/entry/s/example.com/post");
  });

  it("クエリパラメータを保持する", () => {
    const result = buildHatenaBookmarkUrl("https://example.com/post?foo=bar");
    expect(result).toBe(
      "https://b.hatena.ne.jp/entry/s/example.com/post?foo=bar",
    );
  });

  it("末尾スラッシュなしのURLでもパスに二重スラッシュが入らない", () => {
    const result = buildHatenaBookmarkUrl("https://example.com/post");
    // entry/s/ 以降に // が含まれないことを確認
    const path = result.replace("https://b.hatena.ne.jp/entry/s/", "");
    expect(path).not.toContain("//");
  });
});

describe("buildMisskeyShareUrl", () => {
  it("タイトルとURLを含むMisskeyシェアURLを生成する", () => {
    const result = buildMisskeyShareUrl(
      "https://example.com/post",
      "テスト記事",
    );
    expect(result).toContain("https://misskey-hub.net/share?text=");
    expect(result).toContain(encodeURIComponent("テスト記事 | うすゆきブログ"));
    expect(result).toContain(encodeURIComponent("https://example.com/post"));
    expect(result).toContain(encodeURIComponent("#うすゆきブログ"));
  });

  it("特殊文字をエンコードする", () => {
    const result = buildMisskeyShareUrl(
      "https://example.com/post?a=1&b=2",
      "タイトル & 記事",
    );
    expect(result).not.toContain(" ");
    expect(result).not.toContain("&b=2");
  });
});
