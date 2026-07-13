import { describe, it, expect } from "vitest";
import type { ArticleArchiveType } from "~/types/ArticleArchiveType";
import {
  getArticleYear,
  listYears,
  filterByYear,
  sortArticles,
  paginate,
  buildPageList,
  buildArchiveUrl,
} from "../archiveQuery";

// テスト用の記事を生成するヘルパー
function makeArticle(
  slug: string,
  publishedAt: ArticleArchiveType["published_at"],
): ArticleArchiveType {
  return {
    slug,
    published_at: publishedAt,
    title: `記事 ${slug}`,
    isExternal: false,
  };
}

describe("getArticleYear", () => {
  const cases: {
    name: string;
    input: ArticleArchiveType["published_at"];
    expected: number | null;
  }[] = [
    {
      name: "正常系: ISO 8601文字列から公開年を取得できる",
      input: "2024-04-21T10:00:00.000+09:00",
      expected: 2024,
    },
    {
      name: "正常系: DateTypeオブジェクトから公開年を取得できる",
      input: { year: 2021, month: 3, day: 1 },
      expected: 2021,
    },
    {
      name: "異常系: 不正な日付文字列を入れると年を特定できないのでnullを返す",
      input: "not-a-date",
      expected: null,
    },
  ];

  it.each(cases)("$name", ({ input, expected }) => {
    expect(getArticleYear(input)).toBe(expected);
  });
});

describe("listYears", () => {
  const cases: {
    name: string;
    input: ArticleArchiveType[];
    expected: number[];
  }[] = [
    {
      name: "正常系: 存在する年を新しい順で重複なく返す",
      input: [
        makeArticle("a", "2022-01-15T12:00:00.000Z"),
        makeArticle("b", "2024-06-01T12:00:00.000Z"),
        makeArticle("c", "2022-12-30T12:00:00.000Z"),
      ],
      expected: [2024, 2022],
    },
    {
      name: "正常系: 空配列を渡すと空配列を返す",
      input: [],
      expected: [],
    },
    {
      name: "異常系: 不正な日付の記事は年を特定できないので除外される",
      input: [
        makeArticle("a", "invalid"),
        makeArticle("b", "2023-05-01T12:00:00.000Z"),
      ],
      expected: [2023],
    },
  ];

  it.each(cases)("$name", ({ input, expected }) => {
    expect(listYears(input)).toEqual(expected);
  });
});

describe("filterByYear", () => {
  const articles = [
    makeArticle("a", "2022-01-15T12:00:00.000Z"),
    makeArticle("b", "2024-06-01T12:00:00.000Z"),
    makeArticle("c", { year: 2022, month: 12, day: 31 }),
  ];

  const cases: {
    name: string;
    year: number;
    expectedSlugs: string[];
  }[] = [
    {
      name: "正常系: 指定年の記事だけに絞り込める(文字列・DateType混在)",
      year: 2022,
      expectedSlugs: ["a", "c"],
    },
    {
      name: "正常系: 該当記事がない年を指定すると空配列を返す",
      year: 2020,
      expectedSlugs: [],
    },
  ];

  it.each(cases)("$name", ({ year, expectedSlugs }) => {
    expect(filterByYear(articles, year).map((a) => a.slug)).toEqual(
      expectedSlugs,
    );
  });
});

describe("sortArticles", () => {
  const articles = [
    makeArticle("middle", "2023-06-01T12:00:00.000Z"),
    makeArticle("newest", "2024-01-15T12:00:00.000Z"),
    makeArticle("oldest", "2022-01-15T12:00:00.000Z"),
  ];

  const cases: {
    name: string;
    order: "newest" | "oldest";
    expectedSlugs: string[];
  }[] = [
    {
      name: "正常系: newestを指定すると新しい順に並ぶ",
      order: "newest",
      expectedSlugs: ["newest", "middle", "oldest"],
    },
    {
      name: "正常系: oldestを指定すると古い順に並ぶ",
      order: "oldest",
      expectedSlugs: ["oldest", "middle", "newest"],
    },
  ];

  it.each(cases)("$name", ({ order, expectedSlugs }) => {
    expect(sortArticles(articles, order).map((a) => a.slug)).toEqual(
      expectedSlugs,
    );
  });

  it("正常系: 元の配列は変更されない(非破壊)", () => {
    const original = [...articles];
    sortArticles(articles, "oldest");
    expect(articles).toEqual(original);
  });
});

describe("paginate", () => {
  const items = Array.from({ length: 50 }, (_, i) => i + 1);

  const cases: {
    name: string;
    page: number;
    perPage: number;
    expectedFirst: number | undefined;
    expectedLength: number;
    expectedCurrentPage: number;
    expectedTotalPages: number;
  }[] = [
    {
      name: "正常系: 1ページ目は先頭からperPage件を返す",
      page: 1,
      perPage: 24,
      expectedFirst: 1,
      expectedLength: 24,
      expectedCurrentPage: 1,
      expectedTotalPages: 3,
    },
    {
      name: "正常系: 最終ページは端数の件数を返す",
      page: 3,
      perPage: 24,
      expectedFirst: 49,
      expectedLength: 2,
      expectedCurrentPage: 3,
      expectedTotalPages: 3,
    },
    {
      name: "異常系: 範囲外のページ番号を入れると存在しないページなので1ページ目に丸める",
      page: 99,
      perPage: 24,
      expectedFirst: 1,
      expectedLength: 24,
      expectedCurrentPage: 1,
      expectedTotalPages: 3,
    },
    {
      name: "異常系: 0以下のページ番号を入れると不正値なので1ページ目に丸める",
      page: 0,
      perPage: 24,
      expectedFirst: 1,
      expectedLength: 24,
      expectedCurrentPage: 1,
      expectedTotalPages: 3,
    },
    {
      name: "異常系: 小数のページ番号を入れると不正値なので1ページ目に丸める",
      page: 1.5,
      perPage: 24,
      expectedFirst: 1,
      expectedLength: 24,
      expectedCurrentPage: 1,
      expectedTotalPages: 3,
    },
  ];

  it.each(cases)("$name", ({
    page,
    perPage,
    expectedFirst,
    expectedLength,
    expectedCurrentPage,
    expectedTotalPages,
  }) => {
    const result = paginate(items, page, perPage);
    expect(result.items[0]).toBe(expectedFirst);
    expect(result.items).toHaveLength(expectedLength);
    expect(result.currentPage).toBe(expectedCurrentPage);
    expect(result.totalPages).toBe(expectedTotalPages);
  });

  it("正常系: 空配列でもtotalPagesは1になる", () => {
    const result = paginate([], 1, 24);
    expect(result.items).toEqual([]);
    expect(result.totalPages).toBe(1);
    expect(result.currentPage).toBe(1);
  });
});

describe("buildArchiveUrl", () => {
  const cases: {
    name: string;
    params: Parameters<typeof buildArchiveUrl>[0];
    expected: string;
  }[] = [
    {
      name: "正常系: パラメータなしなら素の/archiveを返す",
      params: {},
      expected: "/archive",
    },
    {
      name: "正常系: 年を指定するとyearクエリが付く",
      params: { year: 2024 },
      expected: "/archive?year=2024",
    },
    {
      name: "正常系: oldest指定はsortクエリが付く",
      params: { sort: "oldest" },
      expected: "/archive?sort=oldest",
    },
    {
      name: "正常系: デフォルトのnewestは省略される",
      params: { sort: "newest" },
      expected: "/archive",
    },
    {
      name: "正常系: 2ページ目以降はpageクエリが付く",
      params: { page: 2 },
      expected: "/archive?page=2",
    },
    {
      name: "正常系: 1ページ目のpageは省略される",
      params: { page: 1 },
      expected: "/archive",
    },
    {
      name: "正常系: 年・ソート・ページをまとめて指定できる",
      params: { year: 2023, sort: "oldest", page: 3 },
      expected: "/archive?year=2023&sort=oldest&page=3",
    },
  ];

  it.each(cases)("$name", ({ params, expected }) => {
    expect(buildArchiveUrl(params)).toBe(expected);
  });
});

describe("buildPageList", () => {
  const cases: {
    name: string;
    current: number;
    total: number;
    expected: (number | "ellipsis")[];
  }[] = [
    {
      name: "正常系: 総ページ数が7以下なら省略せず全ページを返す",
      current: 3,
      total: 7,
      expected: [1, 2, 3, 4, 5, 6, 7],
    },
    {
      name: "正常系: 中間ページでは前後と先頭末尾以外を省略する",
      current: 5,
      total: 11,
      expected: [1, "ellipsis", 4, 5, 6, "ellipsis", 11],
    },
    {
      name: "正常系: 先頭ページ付近では前側の省略記号が出ない",
      current: 1,
      total: 11,
      expected: [1, 2, "ellipsis", 11],
    },
    {
      name: "正常系: 末尾ページ付近では後側の省略記号が出ない",
      current: 11,
      total: 11,
      expected: [1, "ellipsis", 10, 11],
    },
    {
      name: "正常系: 総ページ数1なら1だけを返す",
      current: 1,
      total: 1,
      expected: [1],
    },
  ];

  it.each(cases)("$name", ({ current, total, expected }) => {
    expect(buildPageList(current, total)).toEqual(expected);
  });
});
