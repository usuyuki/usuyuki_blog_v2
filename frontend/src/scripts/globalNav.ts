// ハンバーガーメニューの開閉制御
// View Transitions（ClientRouter）対応: ページ遷移のたびに再初期化する
document.addEventListener("astro:page-load", () => {
  const toggle = document.getElementById("global-nav-toggle");
  const nav = document.getElementById("global-nav");
  if (!toggle || !nav) return;

  const abortController = new AbortController();
  // 次のナビゲーション前にイベントリスナーをクリーンアップ
  document.addEventListener(
    "astro:before-preparation",
    () => abortController.abort(),
    { once: true },
  );

  toggle.addEventListener(
    "click",
    () => {
      const open = nav.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(open));
    },
    { signal: abortController.signal },
  );
});
