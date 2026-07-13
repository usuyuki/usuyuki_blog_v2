import { describe, expect, it } from "vitest";
import { isSamePageTraverse } from "../isSamePageTraverse";

describe("isSamePageTraverse", () => {
  it("正常系: 同一パス・同一検索パラメータでnavigationTypeがtraverseならtrueを返す", () => {
    const from = new URL("https://blog.usuyuki.net/some-article#heading-2");
    const to = new URL("https://blog.usuyuki.net/some-article#heading-1");
    expect(isSamePageTraverse(from, to, "traverse")).toBe(true);
  });

  it("異常系: navigationTypeがpushだと、目次タップ直後のpushStateなのでtraverseではないためfalseを返す", () => {
    const from = new URL("https://blog.usuyuki.net/some-article#heading-1");
    const to = new URL("https://blog.usuyuki.net/some-article#heading-2");
    expect(isSamePageTraverse(from, to, "push")).toBe(false);
  });

  it("異常系: navigationTypeがreplaceだと、履歴の置換でしかないためfalseを返す", () => {
    const from = new URL("https://blog.usuyuki.net/some-article");
    const to = new URL("https://blog.usuyuki.net/some-article#heading-1");
    expect(isSamePageTraverse(from, to, "replace")).toBe(false);
  });

  it("異常系: パスが異なると、別記事への遷移でありページ内ハッシュ移動ではないためfalseを返す", () => {
    const from = new URL("https://blog.usuyuki.net/article-a");
    const to = new URL("https://blog.usuyuki.net/article-b");
    expect(isSamePageTraverse(from, to, "traverse")).toBe(false);
  });

  it("異常系: 検索パラメータが異なると、クエリが変わるページ一覧の遷移のためfalseを返す", () => {
    const from = new URL("https://blog.usuyuki.net/archive?page=1");
    const to = new URL("https://blog.usuyuki.net/archive?page=2");
    expect(isSamePageTraverse(from, to, "traverse")).toBe(false);
  });
});
