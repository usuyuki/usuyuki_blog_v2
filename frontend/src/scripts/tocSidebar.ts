// View Transitions（ClientRouter）対応: ページ遷移のたびに再初期化する
document.addEventListener("astro:page-load", () => {
  const abortController = new AbortController();
  const { signal } = abortController;
  const observers: IntersectionObserver[] = [];

  // 次のナビゲーション前にイベントリスナーとObserverをクリーンアップ
  document.addEventListener(
    "astro:before-preparation",
    () => {
      abortController.abort();
      for (const obs of observers) obs.disconnect();
    },
    { once: true },
  );

  const inlineToc = document.getElementById("toc-inline-wrapper");
  const sidebarToc = document.getElementById("toc-sidebar");
  const reactionSidebar = document.getElementById("reaction-sidebar");

  // 目次サイドバーとリアクションサイドバーをまとめて表示・非表示にする
  const showAll = () => {
    if (sidebarToc) {
      sidebarToc.classList.remove("opacity-0", "pointer-events-none");
      sidebarToc.classList.add("opacity-100");
    }
    if (reactionSidebar) {
      reactionSidebar.classList.remove("opacity-0", "pointer-events-none");
      reactionSidebar.classList.add("opacity-100");
    }
  };
  const hideAll = () => {
    if (sidebarToc) {
      sidebarToc.classList.remove("opacity-100");
      sidebarToc.classList.add("opacity-0", "pointer-events-none");
    }
    if (reactionSidebar) {
      reactionSidebar.classList.remove("opacity-100");
      reactionSidebar.classList.add("opacity-0", "pointer-events-none");
    }
  };

  // どちらかのサイドバーが存在する場合のみ表示制御を行う
  if (!sidebarToc && !reactionSidebar) return;

  // Ghost記事はインライン目次、WP記事は記事内toc_containerを基準点にする
  const tocAnchor = inlineToc ?? document.getElementById("toc_container");

  if (tocAnchor) {
    const tocObserver = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          hideAll();
        } else {
          if (entry.boundingClientRect.top < 0) {
            showAll();
          } else {
            hideAll();
          }
        }
      }
    });
    tocObserver.observe(tocAnchor);
    observers.push(tocObserver);
  } else {
    // 目次要素が一切ない場合は常時表示
    showAll();
  }

  // Recent Articles が画面の半分を占めたらフェードアウト、戻ったら復元
  // rootMargin "0px 0px -50% 0px" により検出領域を画面上半分に限定する。
  // article-end が上半分に入った = Recent Articles が下半分以上を占めている状態。
  const articleEnd = document.getElementById("article-end");
  if (articleEnd && tocAnchor) {
    const endObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            hideAll();
          } else {
            // article-end が上半分から外れた（画面下方向に戻った）場合のみ復元
            if (
              entry.boundingClientRect.top > 0 &&
              tocAnchor.getBoundingClientRect().top < 0
            ) {
              showAll();
            }
          }
        }
      },
      { rootMargin: "0px 0px -50% 0px" },
    );
    endObserver.observe(articleEnd);
    observers.push(endObserver);
  }

  // 以下は目次サイドバー固有の処理（現在位置ハイライト・スムーズスクロール）
  if (sidebarToc) {
    // 現在位置のハイライト（h1-h6のみ対象、spanなどは除外）
    const articleHeadings = Array.from(
      document.querySelectorAll<HTMLElement>(
        "article.blog-content h1[id], article.blog-content h2[id], article.blog-content h3[id], article.blog-content h4[id], article.blog-content h5[id], article.blog-content h6[id]",
      ),
    );
    const sidebarLinks = Array.from(
      sidebarToc.querySelectorAll("a[href^='#']"),
    );

    const setActive = (id: string) => {
      for (const link of sidebarLinks) {
        const isActive = link.getAttribute("href") === `#${id}`;
        (link as HTMLElement).style.fontWeight = isActive ? "bold" : "";
        (link as HTMLElement).style.color = isActive ? "var(--orange)" : "";
      }
    };

    // スクロールイベントの代わりに IntersectionObserver でアクティブ見出しを検出する。
    // rootMargin で上端 80px を除外し、見出しが「上に消えた」か「画面内にある」かを追跡する。
    const headingPositions = new Map<Element, "above" | "in-view" | "below">();

    const updateActiveFromPositions = () => {
      // 「above」な見出しの最後、または最初の「in-view」な見出しをアクティブにする
      let activeId = "";
      for (const heading of articleHeadings) {
        const pos = headingPositions.get(heading);
        if (pos === "above") {
          activeId = heading.id;
        } else if (pos === "in-view") {
          activeId = heading.id;
          break;
        }
      }
      setActive(activeId);
    };

    const headingObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            headingPositions.set(entry.target, "in-view");
          } else if (entry.boundingClientRect.top < 0) {
            headingPositions.set(entry.target, "above");
          } else {
            headingPositions.set(entry.target, "below");
          }
        }
        updateActiveFromPositions();
      },
      // 上端 80px（固定ヘッダー分）を除外してから判定する
      { rootMargin: "-80px 0px 0px 0px", threshold: 0 },
    );

    // Observer登録前に現在のスクロール位置から初期位置を設定する
    // これにより、ページ途中にアクセスした場合でも即座にハイライトが反映される
    for (const heading of articleHeadings) {
      const rect = heading.getBoundingClientRect();
      if (rect.top < 0) {
        headingPositions.set(heading, "above");
      } else if (rect.top < window.innerHeight) {
        headingPositions.set(heading, "in-view");
      } else {
        headingPositions.set(heading, "below");
      }
      headingObserver.observe(heading);
    }
    updateActiveFromPositions();
    observers.push(headingObserver);

    // 目次リンクをスムーズスクロールに（インライン・サイドバー共通）
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
      document.querySelectorAll(
        "#toc-inline-wrapper a[href^='#'], #toc-sidebar a[href^='#']",
      ),
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
  }
}); // astro:page-load
