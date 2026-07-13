import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ArticleArchiveType } from "~/types/ArticleArchiveType";

// Ghost API・外部記事取得をモックする
vi.mock("~/libs/ghostClient", () => ({
  ghostApiWithRetry: {
    posts: {
      browse: vi.fn(),
    },
  },
}));

vi.mock("~/libs/rssClient", () => ({
  fetchMultipleRSS: vi.fn(),
}));

vi.mock("~/libs/qiitaClient", () => ({
  fetchQiitaItems: vi.fn(),
}));

vi.mock("~/libs/config", () => ({
  CONFIG: { externalBlogs: [] },
}));

import {
  getAdjacentArticles,
  getAllGhostArticlesForArticlePage,
} from "../articleAggregator";
import { ghostApiWithRetry } from "~/libs/ghostClient";
import { cache } from "~/libs/cache";

// 新しい順(published_at DESC)のGhost記事リスト
const ghostArticles: ArticleArchiveType[] = [
  {
    slug: "newest-post",
    published_at: "2026-06-18T10:00:00.000+09:00",
    title: "最新の記事",
    isExternal: false,
  },
  {
    slug: "middle-post",
    published_at: "2026-05-31T10:00:00.000+09:00",
    title: "真ん中の記事",
    isExternal: false,
  },
  {
    slug: "oldest-post",
    published_at: "2026-05-20T10:00:00.000+09:00",
    title: "最古の記事",
    isExternal: false,
  },
];

describe("getAdjacentArticles", () => {
  const cases: {
    name: string;
    slug: string;
    expectedPrevSlug: string | null;
    expectedNextSlug: string | null;
  }[] = [
    {
      name: "正常系: 中間の記事はprevに古い記事・nextに新しい記事が入る",
      slug: "middle-post",
      expectedPrevSlug: "oldest-post",
      expectedNextSlug: "newest-post",
    },
    {
      name: "正常系: 最新の記事はnextがnullになる",
      slug: "newest-post",
      expectedPrevSlug: "middle-post",
      expectedNextSlug: null,
    },
    {
      name: "正常系: 最古の記事はprevがnullになる",
      slug: "oldest-post",
      expectedPrevSlug: null,
      expectedNextSlug: "middle-post",
    },
    {
      name: "異常系: 存在しないslugを入れるとリストに見つからないのでprev/nextともnullを返す",
      slug: "not-found-post",
      expectedPrevSlug: null,
      expectedNextSlug: null,
    },
  ];

  it.each(cases)("$name", async ({
    slug,
    expectedPrevSlug,
    expectedNextSlug,
  }) => {
    const { prev, next } = await getAdjacentArticles(slug, ghostArticles);
    expect(prev?.slug ?? null).toBe(expectedPrevSlug);
    expect(next?.slug ?? null).toBe(expectedNextSlug);
  });
});

describe("getAllGhostArticlesForArticlePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // getAllArticlesCachedのキャッシュをテスト間でリセットする
    cache.clear();
    vi.mocked(ghostApiWithRetry.posts.browse).mockResolvedValue(ghostArticles);
  });

  it("正常系: 2回目の呼び出しはキャッシュが効いてGhost APIを再呼び出ししない", async () => {
    await getAllGhostArticlesForArticlePage("middle-post");
    await getAllGhostArticlesForArticlePage("newest-post");
    expect(vi.mocked(ghostApiWithRetry.posts.browse)).toHaveBeenCalledTimes(1);
  });

  it("異常系: 公開直後でキャッシュに載っていないslugは、キャッシュを無視して再取得する", async () => {
    // 1回目はキャッシュに乗っていない新規記事一覧、2回目(強制再取得)は新規記事を含む一覧を返す
    const freshArticles: ArticleArchiveType[] = [
      {
        slug: "brand-new-post",
        published_at: "2026-06-19T10:00:00.000+09:00",
        title: "公開直後の記事",
        isExternal: false,
      },
      ...ghostArticles,
    ];
    vi.mocked(ghostApiWithRetry.posts.browse)
      .mockResolvedValueOnce(ghostArticles)
      .mockResolvedValueOnce(freshArticles);

    const articles = await getAllGhostArticlesForArticlePage("brand-new-post");

    expect(articles.map((a) => a.slug)).toContain("brand-new-post");
    // 1回目(キャッシュ経由)で見つからず、2回目(強制再取得)で見つかるので2回呼ばれる
    expect(vi.mocked(ghostApiWithRetry.posts.browse)).toHaveBeenCalledTimes(2);
  });

  it("正常系: キャッシュに該当slugが既にある場合は強制再取得しない", async () => {
    const articles = await getAllGhostArticlesForArticlePage("middle-post");
    expect(articles.map((a) => a.slug)).toContain("middle-post");
    expect(vi.mocked(ghostApiWithRetry.posts.browse)).toHaveBeenCalledTimes(1);
  });
});
