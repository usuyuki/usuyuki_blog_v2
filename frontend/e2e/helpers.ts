import { expect, type Page } from "@playwright/test";

// ページ内で発生した未捕捉のJavaScriptエラーを収集する。
// goto前に呼び出し、テスト末尾で空であることをassertする使い方を想定
export function collectPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => {
    errors.push(error.message);
  });
  return errors;
}

// 横スクロールが発生していない(=レイアウトがビューポートに収まっている)ことを検証する。
// サブピクセルレンダリング誤差を考慮して1pxまで許容する
export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const el = document.documentElement;
    return el.scrollWidth - el.clientWidth;
  });
  expect(overflow, "横スクロールが発生しています").toBeLessThanOrEqual(1);
}
