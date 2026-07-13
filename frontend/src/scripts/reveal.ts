// .reveal要素のスクロール出現アニメーション
// View Transitions（ClientRouter）対応: ページ遷移のたびに再初期化する
document.addEventListener("astro:page-load", () => {
  const targets = document.querySelectorAll(".reveal");
  if (targets.length === 0) return;

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          observer.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.1 },
  );

  for (const target of targets) {
    observer.observe(target);
  }

  // 次のナビゲーション前にObserverをクリーンアップ
  document.addEventListener(
    "astro:before-preparation",
    () => observer.disconnect(),
    { once: true },
  );
});
