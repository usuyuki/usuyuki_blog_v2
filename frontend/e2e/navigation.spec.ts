import { expect, test } from "@playwright/test";

// グローバルナビゲーションの動作検査。
// クライアントスクリプト(globalNav.ts)が3ブラウザで動くことを確認する
test.describe("デスクトップ幅のナビゲーション", () => {
  test("ナビリンクが表示されリンク先へ遷移できる", async ({ page }) => {
    await page.goto("/");
    const nav = page.locator("nav.global-nav");
    for (const label of ["TOP", "ALL", "TAGS", "ABOUT"]) {
      await expect(nav.getByRole("link", { name: label })).toBeVisible();
    }
    await nav.getByRole("link", { name: "ALL" }).click();
    await expect(page).toHaveURL(/\/archive$/);
    await expect(page.locator("header.site-header")).toBeVisible();
  });
});

test.describe("モバイル幅のナビゲーション", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("ハンバーガーメニューが開閉できる", async ({ page }) => {
    await page.goto("/");
    const toggle = page.locator("#global-nav-toggle");
    const nav = page.locator("nav.global-nav");

    // 初期状態ではメニューは閉じている
    await expect(toggle).toBeVisible();
    await expect(nav.getByRole("link", { name: "ABOUT" })).not.toBeVisible();

    // クリックリスナーはastro:page-loadで登録されるため、
    // 登録前のクリックを取りこぼしてもリトライで開くまで待つ
    await expect(async () => {
      await toggle.click();
      await expect(nav).toHaveClass(/open/, { timeout: 1000 });
    }).toPass();

    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(nav.getByRole("link", { name: "ABOUT" })).toBeVisible();

    // もう一度クリックすると閉じる
    await toggle.click();
    await expect(nav).not.toHaveClass(/open/);
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
  });
});
