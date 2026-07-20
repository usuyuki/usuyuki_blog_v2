import { expect, test } from "@playwright/test";
import { collectPageErrors, expectNoHorizontalOverflow } from "./helpers";

// 主要ページが3ブラウザ(chromium/firefox/webkit)で崩れなく表示されることのスモークテスト。
// 記事データはe2e/mock-ghost/fixtures.mjsの固定データを使う
const routes = [
  { path: "/", name: "トップページ" },
  { path: "/archive", name: "記事一覧" },
  { path: "/archive?year=2025", name: "記事一覧(年フィルター)" },
  { path: "/archive?sort=oldest&page=2", name: "記事一覧(ソート+ページャ)" },
  { path: "/tags", name: "タグ一覧" },
  { path: "/tags/tech", name: "タグ別記事一覧" },
  { path: "/aboutThisBlog", name: "Aboutページ" },
  { path: "/reactions", name: "リアクションページ" },
  { path: "/e2e-post-1", name: "記事詳細" },
];

for (const route of routes) {
  test(`${route.name} (${route.path}) が正常に表示される`, async ({ page }) => {
    const errors = collectPageErrors(page);
    const response = await page.goto(route.path);

    expect(response?.status()).toBe(200);
    // 共通シェル(ヘッダー・フッター)が描画されている
    await expect(page.locator("header.site-header")).toBeVisible();
    await expect(page.locator("footer.site-footer")).toBeVisible();
    await expectNoHorizontalOverflow(page);
    expect(errors, "未捕捉のJSエラーが発生しています").toEqual([]);
  });
}

// モバイル幅でのレイアウト崩れ(横スクロール)検査
test.describe("モバイル幅(390px)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const route of routes) {
    test(`${route.name} (${route.path}) が横に崩れない`, async ({ page }) => {
      const response = await page.goto(route.path);
      expect(response?.status()).toBe(200);
      await expect(page.locator("header.site-header")).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });
  }
});
