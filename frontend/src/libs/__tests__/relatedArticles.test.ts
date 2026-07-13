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

import { getRelatedArticles } from "../articleAggregator";
import { ghostApiWithRetry } from "~/libs/ghostClient";
import { cache } from "~/libs/cache";

function makeArticle(slug: string, publishedAt: string): ArticleArchiveType {
  return {
    slug,
    published_at: publishedAt,
    title: `記事 ${slug}`,
    isExternal: false,
  };
}

const currentPost = {
  slug: "current-post",
  tags: [
    { name: "アニメ", slug: "anime" },
    { name: "おでかけ", slug: "odekake" },
  ],
};

describe("getRelatedArticles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cache.clear();
  });

  it("正常系: タグが共通する記事をタググループフィルターで取得する", async () => {
    const relatedByTag = [
      makeArticle("related-1", "2026-01-01T00:00:00.000+09:00"),
      makeArticle("related-2", "2025-01-01T00:00:00.000+09:00"),
      makeArticle("related-3", "2024-01-01T00:00:00.000+09:00"),
    ];
    vi.mocked(ghostApiWithRetry.posts.browse).mockResolvedValue(relatedByTag);

    const articles = await getRelatedArticles(currentPost);

    expect(articles.map((a) => a.slug)).toEqual([
      "related-1",
      "related-2",
      "related-3",
    ]);
    expect(vi.mocked(ghostApiWithRetry.posts.browse)).toHaveBeenCalledWith({
      filter: "tags:[anime,odekake]+slug:-current-post",
      order: "published_at DESC",
      limit: 3,
      include: "tags",
    });
  });

  it("正常系: タグ一致が不足する場合は最新記事から自分と重複を除いて補完する", async () => {
    vi.mocked(ghostApiWithRetry.posts.browse).mockImplementation(
      async (options) => {
        // タググループフィルターの呼び出しには1件だけ返す
        if (options.filter?.startsWith("tags:[")) {
          return [makeArticle("related-1", "2026-01-01T00:00:00.000+09:00")];
        }
        // フォールバック(最新記事)の呼び出し
        return [
          makeArticle("current-post", "2026-06-01T00:00:00.000+09:00"),
          makeArticle("related-1", "2026-01-01T00:00:00.000+09:00"),
          makeArticle("fallback-1", "2025-06-01T00:00:00.000+09:00"),
          makeArticle("fallback-2", "2025-01-01T00:00:00.000+09:00"),
        ];
      },
    );

    const articles = await getRelatedArticles(currentPost);

    expect(articles.map((a) => a.slug)).toEqual([
      "related-1",
      "fallback-1",
      "fallback-2",
    ]);
  });

  it("正常系: タグがない記事はタグ検索せず最新記事だけで補完する", async () => {
    vi.mocked(ghostApiWithRetry.posts.browse).mockResolvedValue([
      makeArticle("latest-1", "2026-06-01T00:00:00.000+09:00"),
      makeArticle("latest-2", "2026-05-01T00:00:00.000+09:00"),
      makeArticle("latest-3", "2026-04-01T00:00:00.000+09:00"),
    ]);

    const articles = await getRelatedArticles({ slug: "no-tag-post" });

    expect(articles).toHaveLength(3);
    // タググループフィルターでの呼び出しがないこと
    const filterCalls = vi
      .mocked(ghostApiWithRetry.posts.browse)
      .mock.calls.filter((call) => call[0].filter?.startsWith("tags:["));
    expect(filterCalls).toHaveLength(0);
  });

  it("異常系: タグ検索がエラーになると関連が取れないのでフォールバックの最新記事を返す", async () => {
    vi.mocked(ghostApiWithRetry.posts.browse).mockImplementation(
      async (options) => {
        if (options.filter?.startsWith("tags:[")) {
          throw new Error("Ghost API error");
        }
        return [
          makeArticle("fallback-1", "2026-06-01T00:00:00.000+09:00"),
          makeArticle("fallback-2", "2026-05-01T00:00:00.000+09:00"),
          makeArticle("fallback-3", "2026-04-01T00:00:00.000+09:00"),
        ];
      },
    );

    const articles = await getRelatedArticles(currentPost);

    expect(articles.map((a) => a.slug)).toEqual([
      "fallback-1",
      "fallback-2",
      "fallback-3",
    ]);
  });

  it("異常系: タグ検索もフォールバックもエラーになると取得手段がないので空配列を返す", async () => {
    vi.mocked(ghostApiWithRetry.posts.browse).mockRejectedValue(
      new Error("Ghost API down"),
    );

    const articles = await getRelatedArticles(currentPost);

    expect(articles).toEqual([]);
  });
});
