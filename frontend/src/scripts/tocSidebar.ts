// 記事ページの目次スクリプト
// サイドバー目次はCSSのstickyで固定されるため、ここではスクロールスパイ
// (現在見出しのハイライト)とスムーズスクロールだけを行う。
// View Transitions（ClientRouter）対応: ページ遷移のたびに再初期化する
document.addEventListener("astro:page-load", () => {
  const abortController = new AbortController();
  const { signal } = abortController;

  // 次のナビゲーション前にイベントリスナーをクリーンアップ
  document.addEventListener(
    "astro:before-preparation",
    () => abortController.abort(),
    { once: true },
  );

  // 目次リンクをスムーズスクロールに(インライン・サイドバー共通)
  const smoothScrollTo = (href: string) => {
    const id = href.slice(1);
    const target =
      document.getElementById(id) ||
      document.getElementById(decodeURIComponent(id));
    if (target) {
      target.scrollIntoView({ behavior: "smooth" });
      history.pushState(null, "", href);
    }
  };

  const allTocLinks = Array.from(
    document.querySelectorAll(".article-toc a[href^='#']"),
  );
  for (const link of allTocLinks) {
    link.addEventListener(
      "click",
      (e) => {
        e.preventDefault();
        const href = link.getAttribute("href");
        if (href) smoothScrollTo(href);
      },
      { signal },
    );
  }

  // サイドバー目次のスクロールスパイ(現在位置の見出しを黒反転)
  const sidebarToc = document.getElementById("toc-sidebar");
  if (!sidebarToc) return;

  // h1-h6のみ対象、spanなどは除外
  const articleHeadings = Array.from(
    document.querySelectorAll<HTMLElement>(
      "article.blog-content h1[id], article.blog-content h2[id], article.blog-content h3[id], article.blog-content h4[id], article.blog-content h5[id], article.blog-content h6[id]",
    ),
  );
  const sidebarLinks = Array.from(sidebarToc.querySelectorAll("a[href^='#']"));
  if (articleHeadings.length === 0 || sidebarLinks.length === 0) return;

  const setActive = (id: string) => {
    for (const link of sidebarLinks) {
      link.classList.toggle("active", link.getAttribute("href") === `#${id}`);
    }
  };

  // スクロール位置から直接アクティブ見出しを計算する。
  // IntersectionObserver はデッドゾーンで再発火しないケースがあるため
  // スクロールベースの計算にしている。
  const HEADER_HEIGHT = 90;

  const updateActiveHeading = () => {
    let activeId = "";
    for (const heading of articleHeadings) {
      // 固定ヘッダー付近(90px)以内に入った見出しをアクティブとみなす
      if (heading.getBoundingClientRect().top <= HEADER_HEIGHT) {
        activeId = heading.id;
      } else {
        break;
      }
    }
    setActive(activeId);
  };

  window.addEventListener("scroll", updateActiveHeading, {
    signal,
    passive: true,
  });
  updateActiveHeading();
});
