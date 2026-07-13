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
      history.replaceState(history.state, "", href);
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

  // 目次のスクロールスパイ(現在位置の見出しを黒反転)。サイドバー・モバイルモーダルの両方が対象
  // h1-h6のみ対象、spanなどは除外
  const articleHeadings = Array.from(
    document.querySelectorAll<HTMLElement>(
      "article.blog-content h1[id], article.blog-content h2[id], article.blog-content h3[id], article.blog-content h4[id], article.blog-content h5[id], article.blog-content h6[id]",
    ),
  );
  if (articleHeadings.length === 0 || allTocLinks.length === 0) return;

  const setActive = (id: string) => {
    for (const link of allTocLinks) {
      const isActive = link.getAttribute("href") === `#${id}`;
      link.classList.toggle("active", isActive);
      // 目次が長くスクロール可能な場合、アクティブ項目が隠れていたら自動追従させる
      // ※本文冒頭のインライン目次（.toc-modal 内ではない .article-toc.inline）は
      // 自身のスクロールバーを持たず、scrollIntoViewを呼ぶと画面全体がスクロールして戻されてしまうため除外
      if (isActive) {
        const isBodyInline = link.closest(".article-toc.inline") && !link.closest(".toc-modal");
        if (!isBodyInline) {
          link.scrollIntoView({ block: "nearest" });
        }
      }
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

// モバイル用: 本文冒頭の目次(toc-inline)がスクロールで見切れたらフローティングボタンを表示し、
// タップでモーダルとして目次を開閉する
document.addEventListener("astro:page-load", () => {
  const abortController = new AbortController();
  const { signal } = abortController;
  document.addEventListener(
    "astro:before-preparation",
    () => abortController.abort(),
    { once: true },
  );

  const floatButton = document.getElementById("toc-float-button");
  const modal = document.getElementById("toc-modal");
  const modalBackdrop = document.getElementById("toc-modal-backdrop");
  const modalLabel = document.getElementById("toc-modal-label");
  if (!floatButton || !modal || !modalBackdrop || !modalLabel) {
    return;
  }

  // 監視対象: 通常は本文冒頭の目次(toc-inline)、WordPress記事は本文内に独自目次があるため記事ヘッダーを見る
  const observeTargetId =
    floatButton.dataset.tocObserveTarget === "header"
      ? "article-header"
      : "toc-inline-wrapper";
  const observeTarget = document.getElementById(observeTargetId);
  if (!observeTarget) {
    return;
  }

  // 監視対象が画面上端より上にスクロールしたらボタンを表示する
  const observer = new IntersectionObserver(
    ([entry]) => {
      floatButton.classList.toggle(
        "visible",
        entry !== undefined &&
          !entry.isIntersecting &&
          entry.boundingClientRect.top < 0,
      );
    },
    { threshold: 0 },
  );
  observer.observe(observeTarget);
  document.addEventListener(
    "astro:before-preparation",
    () => observer.disconnect(),
    {
      once: true,
    },
  );

  const openModal = () => {
    modal.classList.add("open");
    document.body.style.overflow = "hidden";
  };
  const closeModal = () => {
    modal.classList.remove("open");
    document.body.style.overflow = "";
  };

  floatButton.addEventListener("click", openModal, { signal });
  modalBackdrop.addEventListener("click", closeModal, { signal });
  modalLabel.addEventListener("click", closeModal, { signal });

  // モーダル内の目次リンクをクリックしたら遷移前に閉じる
  const modalTocLinks = modal.querySelectorAll(".article-toc a[href^='#']");
  for (const link of modalTocLinks) {
    link.addEventListener("click", closeModal, { signal });
  }
});
