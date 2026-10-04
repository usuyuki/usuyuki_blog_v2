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

  test("コードブロックがシンタックスハイライトされる", async ({ page }) => {
    await page.goto("/e2e-post-1");
    const codeBlock = page.locator("article.blog-content pre.shiki");
    await expect(codeBlock).toBeVisible();
    await expect(codeBlock).toContainText("func");
  });

  test("mermaidブロックがSVG図として描画される", async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.goto("/e2e-post-1");
    const mermaidBlock = page.locator("article.blog-content pre.mermaid");
    await expect(mermaidBlock).toBeVisible();
    await expect(mermaidBlock.locator("svg")).toBeVisible();
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

  test("正常系: 目次が長くてもサイドバーのリアクション欄が画面内に収まり、目次はスクロールできる", async ({
    page,
  }) => {
    // サイドバー(1020px以上)が表示される幅で、高さは低めにして目次があふれやすくする
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto("/e2e-post-1");
    const tocList = page.locator("#toc-sidebar ol");
    await expect(tocList).toBeVisible();

    // fixtureの見出しは2件しかないため、目次項目をDOM上で水増しして長い目次を再現する
    await tocList.evaluate((ol) => {
      for (let i = 0; i < 60; i++) {
        const li = document.createElement("li");
        li.className = "level-2";
        li.innerHTML = `<a href="#section-1">ダミー見出し${i}</a>`;
        ol.appendChild(li);
      }
    });

    // 目次はあふれた分を内部スクロールで表示する
    const isTocScrollable = await tocList.evaluate(
      (ol) => ol.scrollHeight > ol.clientHeight,
    );
    expect(isTocScrollable).toBe(true);

    // sticky固定時(top: ヘッダー60px+40px)にリアクション欄まで画面内に収まるよう、
    // サイドバー全体の高さが「ビューポート高さ-ヘッダー-上下余白(80px)」以内に収まっている
    const sideHeight = await page
      .locator(".article-side-sticky")
      .evaluate((el) => el.getBoundingClientRect().height);
    expect(sideHeight).toBeLessThanOrEqual(720 - 60 - 80);
  });

  test("正常系: 目次が長くリアクションが3行以上あっても、折りたたみ時のリアクション欄が画面内に収まる", async ({
    page,
  }) => {
    // E2E環境のリアクションAPIは空を返すため、3行以上(「もっと見る」が出る量)のリアクションを返すようモックする
    const emojis = Array.from({ length: 30 }, (_, i) =>
      String.fromCodePoint(0x1f600 + i),
    );
    await page.route("**/api/reactions/**", (route) =>
      route.fulfill({
        json: {
          reactions: emojis.map((emoji) => ({
            emoji,
            count: 1,
            reacted: false,
          })),
        },
      }),
    );
    // 高さ600pxでは、リアクション一覧に割り当てられる高さ(約57px)が折りたたみ時の2行分(112px)より小さい
    await page.setViewportSize({ width: 1280, height: 600 });
    await page.goto("/e2e-post-1");

    const sidebar = page.locator(".article-side-sticky");
    const tocList = sidebar.locator("#toc-sidebar ol");
    await expect(tocList).toBeVisible();
    await tocList.evaluate((ol) => {
      for (let i = 0; i < 60; i++) {
        const li = document.createElement("li");
        li.className = "level-2";
        li.innerHTML = `<a href="#section-1">ダミー見出し${i}</a>`;
        ol.appendChild(li);
      }
    });
    // 折りたたみ状態(「もっと見る」が出ている)で検証する
    await expect(sidebar.getByText("もっと見る ▼")).toBeVisible();

    const sideHeight = await sidebar.evaluate(
      (el) => el.getBoundingClientRect().height,
    );
    expect(sideHeight).toBeLessThanOrEqual(600 - 60 - 80);
  });

  test("正常系: スマホではINDEXボタンが画面右側に出て、目次パネルが右端から開く", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/e2e-post-1");

    // 本文冒頭の目次が見切れるまでスクロールするとフローティングボタンが出る
    await page.evaluate(() => {
      const inline = document.getElementById("toc-inline-wrapper");
      if (inline)
        window.scrollTo(
          0,
          inline.getBoundingClientRect().bottom + window.scrollY + 10,
        );
    });
    const floatButton = page.locator("#toc-float-button");
    await expect(floatButton).toHaveClass(/visible/);
    const buttonBox = await floatButton.boundingBox();
    expect(buttonBox).not.toBeNull();
    // ボタンの中心が画面の右半分にある
    expect((buttonBox?.x ?? 0) + (buttonBox?.width ?? 0) / 2).toBeGreaterThan(
      390 / 2,
    );

    await floatButton.click();
    const panel = page.locator(".toc-modal-panel");
    // スライドインのアニメーション完了後、パネルの右端が画面右端に揃う
    await expect
      .poll(async () => {
        const box = await panel.boundingBox();
        return box ? Math.round(box.x + box.width) : null;
      })
      .toBe(390);
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
