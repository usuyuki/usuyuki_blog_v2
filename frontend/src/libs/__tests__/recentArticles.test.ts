import { describe, it, expect, vi } from "vitest";
import type { ArticleArchiveType } from "~/types/ArticleArchiveType";

// articleAggregatorの読み込み時に外部依存を初期化しないようモックする
vi.mock("~/libs/ghostClient", () => ({
  ghostApiWithRetry: { posts: { browse: vi.fn() } },
}));
vi.mock("~/libs/rssClient", () => ({ fetchMultipleRSS: vi.fn() }));
vi.mock("~/libs/qiitaClient", () => ({ fetchQiitaItems: vi.fn() }));
vi.mock("~/libs/config", () => ({ CONFIG: { externalBlogs: [] } }));

import { getRecentArticles } from "../articleAggregator";

function makeArticle(slug: string): ArticleArchiveType {
  return {
    slug,
    published_at: "2026-01-01T00:00:00.000+09:00",
    title: `記事 ${slug}`,
    isExternal: false,
  };
}

// 新しい順に並んだ全記事リスト
const allGhostArticles = ["post-1", "post-2", "post-3", "post-4", "post-5"].map(
  makeArticle,
);

describe("getRecentArticles", () => {
  const cases: {
    name: string;
    slug: string;
    articles: ArticleArchiveType[];
    limit?: number;
    expected: string[];
  }[] = [
    {
      name: "正常系: 表示中の記事が最新でなければ、最新から順に自分以外の3件を返す",
      slug: "post-4",
      articles: allGhostArticles,
      expected: ["post-1", "post-2", "post-3"],
    },
    {
      name: "正常系: 表示中の記事が最新なら、それを除いた次の3件を返す",
      slug: "post-1",
      articles: allGhostArticles,
      expected: ["post-2", "post-3", "post-4"],
    },
    {
      name: "正常系: limitを指定するとその件数だけ返す",
      slug: "post-1",
      articles: allGhostArticles,
      limit: 2,
      expected: ["post-2", "post-3"],
    },
    {
      name: "正常系: 自分以外の記事がlimitより少なければあるだけ返す",
      slug: "post-1",
      articles: allGhostArticles.slice(0, 2),
      expected: ["post-2"],
    },
    {
      name: "正常系: 全記事リストが空なら空配列を返す",
      slug: "post-1",
      articles: [],
      expected: [],
    },
  ];

  it.each(cases)("$name", ({ slug, articles, limit, expected }) => {
    const result = getRecentArticles(slug, articles, limit);
    expect(result.map((a) => a.slug)).toEqual(expected);
  });
});
