import { expect, test } from "@playwright/test";
import { collectPageErrors } from "./helpers";

// /dev配下(執筆者用ページ)のBasic認証とグラフのプレビューの検査。
// E2Eは本番ビルドで動くため、playwright.config.tsで渡した認証情報によるBasic認証がかかる
const credentials = { username: "e2e-user", password: "e2e-password" };

test.describe("執筆者用ページ(/dev)", () => {
  test("異常系: 認証情報なしで開くと、ブラウザに入力を促すため401になる", async ({
    request,
  }) => {
    const response = await request.get("/dev/chart-preview");
    expect(response.status()).toBe(401);
    expect(response.headers()["www-authenticate"]).toContain("Basic");
  });

  test("異常系: パスワードを間違えると401になる", async ({ playwright }) => {
    const context = await playwright.request.newContext({
      baseURL: test.info().project.use.baseURL,
      httpCredentials: { ...credentials, password: "wrong" },
    });
    const response = await context.get("/dev/chart-preview");
    expect(response.status()).toBe(401);
    await context.dispose();
  });

  test.describe("正しい認証情報", () => {
    test.use({ httpCredentials: credentials });

    test("正常系: 一覧ページからグラフのプレビューへ移動できる", async ({
      page,
    }) => {
      const response = await page.goto("/dev");
      expect(response?.headers()["x-robots-tag"]).toContain("noindex");
      expect(response?.headers()["cache-control"]).toContain("no-store");
      await page.getByRole("link", { name: /グラフのプレビュー/ }).click();
      await expect(page).toHaveURL(/\/dev\/chart-preview$/);
    });

    test("正常系: サンプルを切り替えると棒・折れ線・円グラフが描画され、不正なJSONは理由を表示する", async ({
      page,
    }) => {
      const errors = collectPageErrors(page);
      await page.goto("/dev/chart-preview");
      const output = page.locator("#chart-preview-output figure.chart");

      await expect(output.locator("rect.chart-bar")).toHaveCount(6);
      await page.getByRole("button", { name: "折れ線グラフ" }).click();
      await expect(output.locator("polyline.chart-line")).toHaveCount(2);
      await page.getByRole("button", { name: "円グラフ" }).click();
      await expect(output.locator("path.chart-slice")).toHaveCount(3);

      await page.locator("#chart-preview-source").fill("{broken");
      await expect(page.locator("#chart-preview-error")).toContainText("JSON");
      expect(errors, "未捕捉のJSエラーが発生しています").toEqual([]);
    });
  });
});
