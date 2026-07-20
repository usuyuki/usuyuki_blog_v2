import { expect, test } from "@playwright/test";
import { collectPageErrors } from "./helpers";

// 記事詳細ページの表示内容の検査。
// fixtureのe2e-post-1(tech・見出しあり)、e2e-post-2(前後両方に記事あり)を使う
test.describe("記事詳細ページ", () => {
  test("タイトル・本文・タグが表示される", async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.goto("/e2e-post-1");

    // budouxがタイトルに改行候補を挿入するためtoContainTextで検証する
    await expect(page.locator("h1.article-title")).toContainText(
      "E2Eテスト用記事1",
    );
    // 本文と見出し(TOC生成元)が描画されている
    const body = page.locator("article.blog-content");
    await expect(body).toBeVisible();
    await expect(body.locator("h2#section-1")).toHaveText("最初の見出し");
    // 公開タグは表示され、内部タグ(#internal)は表示されない
    const articleHeader = page.locator("#article-header");
    await expect(articleHeader).toContainText("技術");
    await expect(articleHeader).not.toContainText("#internal");
    expect(errors, "未捕捉のJSエラーが発生しています").toEqual([]);
  });

  test("前後記事ナビゲーションが表示される", async ({ page }) => {
    await page.goto("/e2e-post-2");
    const prevNext = page.locator("nav.prev-next");
    // 新しい順でe2e-post-1が次、e2e-post-3が前
    await expect(prevNext.locator("a.next")).toHaveAttribute(
      "href",
      "/e2e-post-1",
    );
    await expect(prevNext.locator("a.prev")).toHaveAttribute(
      "href",
      "/e2e-post-3",
    );
  });

  test("関連記事セクションが表示される", async ({ page }) => {
    await page.goto("/e2e-post-1");
    const related = page.locator("section.related");
    await expect(related).toBeVisible();
    // 同じtechタグの他記事へのリンクがある
    await expect(
      related.locator("a[href='/e2e-post-3']").first(),
    ).toBeVisible();
  });

  test("存在しない記事は404を返す", async ({ page }) => {
    const response = await page.goto("/no-such-post-xyz");
    expect(response?.status()).toBe(404);
  });
});

test.describe("フィード", () => {
  test("RSSフィードが配信される", async ({ request }) => {
    const response = await request.get("/rss.xml");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("xml");
    expect(await response.text()).toContain("e2e-post-1");
  });
});
