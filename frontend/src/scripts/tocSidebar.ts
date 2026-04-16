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

	if (sidebarToc) {
		const showSidebar = () => {
			sidebarToc.classList.remove("opacity-0", "pointer-events-none");
			sidebarToc.classList.add("opacity-100");
		};
		const hideSidebar = () => {
			sidebarToc.classList.remove("opacity-100");
			sidebarToc.classList.add("opacity-0", "pointer-events-none");
		};

		// Ghost記事はインライン目次、WP記事は記事内toc_containerを基準点にする
		const tocAnchor = inlineToc ?? document.getElementById("toc_container");

		if (tocAnchor) {
			const tocObserver = new IntersectionObserver((entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						hideSidebar();
					} else {
						if (entry.boundingClientRect.top < 0) {
							showSidebar();
						} else {
							hideSidebar();
						}
					}
				}
			});
			tocObserver.observe(tocAnchor);
			observers.push(tocObserver);
		} else {
			// 目次要素が一切ない場合は常時表示
			showSidebar();
		}

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

		for (const heading of articleHeadings) {
			headingObserver.observe(heading);
		}
		observers.push(headingObserver);

		// Recent Articles エリアに入ったらフェードアウト、戻ったら復元
		const articleEnd = document.getElementById("article-end");
		if (articleEnd && tocAnchor) {
			const endObserver = new IntersectionObserver((entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						hideSidebar();
					} else {
						// article-end が画面下に消えた（上スクロールで戻った）場合のみ復元
						// top > 0 = 下方向にある = 上スクロールで戻ってきた
						if (
							entry.boundingClientRect.top > 0 &&
							tocAnchor.getBoundingClientRect().top < 0
						) {
							showSidebar();
						}
					}
				}
			});
			endObserver.observe(articleEnd);
			observers.push(endObserver);
		}

		// 目次リンクをスムーズスクロールに（インライン・サイドバー共通）
		const smoothScrollTo = (href: string) => {
			const id = href.slice(1);
			const target =
				document.getElementById(id) ||
				document.getElementById(decodeURIComponent(id));
			target?.scrollIntoView({ behavior: "smooth" });
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
