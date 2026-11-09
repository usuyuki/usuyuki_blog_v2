import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { ArticleArchiveType } from "~/types/ArticleArchiveType";

vi.mock("~/libs/ghostClient", () => ({
  ghostApiWithRetry: {
    posts: {
      browse: vi.fn(),
    },
  },
}));

vi.mock("~/libs/rssClient", () => ({
  fetchMultipleRSS: vi.fn(async () => []),
}));

vi.mock("~/libs/qiitaClient", () => ({
  fetchQiitaItems: vi.fn(async () => []),
}));

vi.mock("~/libs/config", () => ({
  get CONFIG() {
    return { externalBlogs: [] };
  },
}));

function ghostPost(slug: string): ArticleArchiveType {
  return {
    slug,
    published_at: "2026-01-01T00:00:00.000Z",
    title: slug,
    isExternal: false,
  };
}

// browseのモックを「1ページ目にslugsの記事、2ページ目以降は空」となるよう設定する(null=Ghost停止)
function mockGhostPages(
  browse: ReturnType<typeof vi.fn>,
  slugs: string[] | null,
) {
  browse.mockImplementation(async ({ page }: { page: number }) => {
    if (slugs === null) return null;
    return page === 1 ? slugs.map(ghostPost) : [];
  });
}

// articleAggregatorはモジュール内に取得時刻などの状態を持つため、テストごとに読み込み直す
async function loadModules() {
  vi.resetModules();
  const aggregator = await import("../articleAggregator");
  const { ghostApiWithRetry } = await import("~/libs/ghostClient");
  const browse = vi.mocked(ghostApiWithRetry.posts.browse) as ReturnType<
    typeof vi.fn
  >;
  return { ...aggregator, browse };
}

// Ghostへの全件取得(1ページ目のbrowse)が何回走ったかを数える
function countFullFetches(browse: ReturnType<typeof vi.fn>): number {
  return browse.mock.calls.filter(([opts]) => opts.page === 1).length;
}

describe("checkPublishedGhostSlug", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-18T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  const tests: {
    name: string;
    // 1回目の判定前のGhostの状態(null=停止)
    ghostBefore: string[] | null;
    // 1回目の判定後、2回目の判定前のGhostの状態
    ghostAfter: string[] | null;
    // 1回目から2回目までの経過時間
    elapsedMs: number;
    slug: string;
    want: [string, string];
    wantFullFetches: number;
  }[] = [
    {
      name: "正常系: 一覧が新しくslugを含むならGhostに問い合わせず公開中と判定する",
      ghostBefore: ["a"],
      ghostAfter: ["a"],
      elapsedMs: 60_000,
      slug: "a",
      want: ["published", "published"],
      // 1回目のみ。2回目はキャッシュから判定する
      wantFullFetches: 1,
    },
    {
      name: "正常系: 一覧が5分より古いと取り直すので、非公開にした記事は見つからなくなる",
      ghostBefore: ["a"],
      ghostAfter: [],
      elapsedMs: 5 * 60_000 + 1,
      slug: "a",
      want: ["published", "not_found"],
      wantFullFetches: 2,
    },
    {
      name: "正常系: 公開直後で一覧に無い記事は、再取得の間隔が空いていれば取り直して見つかる",
      ghostBefore: ["a"],
      ghostAfter: ["a", "new"],
      elapsedMs: 60_000,
      slug: "new",
      want: ["not_found", "published"],
      wantFullFetches: 2,
    },
    {
      name: "異常系: 架空のslugを1分以内に繰り返し入れても再取得の間隔内なのでGhostへの全件取得は増えずnot_foundになる",
      ghostBefore: ["a"],
      ghostAfter: ["a"],
      elapsedMs: 10_000,
      slug: "fake",
      want: ["not_found", "not_found"],
      wantFullFetches: 1,
    },
    {
      name: "異常系: Ghost停止中に繰り返し入れても再取得の間隔内なので全件取得は増えずunavailableになる",
      ghostBefore: null,
      ghostAfter: null,
      elapsedMs: 10_000,
      slug: "a",
      want: ["unavailable", "unavailable"],
      wantFullFetches: 1,
    },
    {
      name: "正常系: 取り直しに失敗しても手元の一覧があればそれで判定を続ける",
      ghostBefore: ["a"],
      ghostAfter: null,
      elapsedMs: 5 * 60_000 + 1,
      slug: "a",
      want: ["published", "published"],
      wantFullFetches: 2,
    },
  ];

  for (const tt of tests) {
    it(tt.name, async () => {
      const { checkPublishedGhostSlug, browse } = await loadModules();

      mockGhostPages(browse, tt.ghostBefore);
      const first = await checkPublishedGhostSlug(tt.slug);

      vi.advanceTimersByTime(tt.elapsedMs);
      mockGhostPages(browse, tt.ghostAfter);
      const second = await checkPublishedGhostSlug(tt.slug);

      expect([first, second]).toEqual(tt.want);
      expect(countFullFetches(browse)).toBe(tt.wantFullFetches);
    });
  }
});

describe("checkPublishedGhostSlug の同時呼び出し", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-18T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("正常系: 一覧が無い状態で同時に呼ばれても、後続は取得中の結果を待つので公開中と判定され、全件取得は1回で済む", async () => {
    const { checkPublishedGhostSlug, browse } = await loadModules();
    mockGhostPages(browse, ["a"]);

    const results = await Promise.all([
      checkPublishedGhostSlug("a"),
      checkPublishedGhostSlug("a"),
    ]);

    expect(results).toEqual(["published", "published"]);
    expect(countFullFetches(browse)).toBe(1);
  });
});

describe("記事一覧の強制再取得の間隔制限", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-18T00:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  const tests: {
    name: string;
    // checkPublishedGhostSlugで架空slugを判定してから、記事詳細ページの取得までの経過時間
    elapsedMs: number;
    want: string[];
    wantFullFetches: number;
  }[] = [
    {
      name: "異常系: 再取得の間隔内に記事詳細ページから強制再取得しようとしても、間隔制限が共通なので全件取得は増えず手元の一覧を返す",
      elapsedMs: 10_000,
      want: ["a"],
      wantFullFetches: 1,
    },
    {
      name: "正常系: 再取得の間隔が空いていれば記事詳細ページから取り直して公開直後の記事も見つかる",
      elapsedMs: 60_000,
      want: ["a", "new"],
      wantFullFetches: 2,
    },
  ];

  for (const tt of tests) {
    it(tt.name, async () => {
      const {
        checkPublishedGhostSlug,
        getAllGhostArticlesForArticlePage,
        browse,
      } = await loadModules();
      mockGhostPages(browse, ["a"]);
      await checkPublishedGhostSlug("fake");

      vi.advanceTimersByTime(tt.elapsedMs);
      mockGhostPages(browse, ["a", "new"]);
      const articles = await getAllGhostArticlesForArticlePage("new");

      expect(articles.map((a) => a.slug)).toEqual(tt.want);
      expect(countFullFetches(browse)).toBe(tt.wantFullFetches);
    });
  }
});

describe("getAllArticlesCached の同時取得", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("正常系: キャッシュが無い状態で同時に呼ばれてもGhostへの全件取得は1回にまとめられる", async () => {
    const { getAllArticlesCached, browse } = await loadModules();
    mockGhostPages(browse, ["a"]);

    const results = await Promise.all([
      getAllArticlesCached(false),
      getAllArticlesCached(false),
      getAllArticlesCached(false, true),
    ]);

    expect(results.map((r) => r.map((a) => a.slug))).toEqual([
      ["a"],
      ["a"],
      ["a"],
    ]);
    expect(countFullFetches(browse)).toBe(1);
  });

  it("正常系: 取得が終わった後の呼び出しは相乗りせず、強制再取得なら取り直す", async () => {
    const { getAllArticlesCached, browse } = await loadModules();
    mockGhostPages(browse, ["a"]);

    await getAllArticlesCached(false);
    await getAllArticlesCached(false, true);

    expect(countFullFetches(browse)).toBe(2);
  });
});
