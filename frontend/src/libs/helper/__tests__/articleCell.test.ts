import { describe, it, expect } from "vitest";
import {
  articleHref,
  viewTransitionSlug,
  thumbGradient,
  sourceBadgeBackground,
} from "../articleCell";

describe("articleHref", () => {
  const cases: {
    name: string;
    article: Parameters<typeof articleHref>[0];
    expected: string;
  }[] = [
    {
      name: "正常系: 内部記事はslugから内部パスを返す",
      article: { slug: "my-post", isExternal: false },
      expected: "/my-post",
    },
    {
      name: "正常系: 外部記事はexternalUrlを返す",
      article: {
        slug: "https://qiita.com/user/items/abc",
        isExternal: true,
        externalUrl: "https://qiita.com/user/items/abc",
      },
      expected: "https://qiita.com/user/items/abc",
    },
    {
      name: "異常系: 外部記事なのにexternalUrlがない場合はURLが入っているslugへフォールバックする",
      article: { slug: "https://zenn.dev/user/articles/xyz", isExternal: true },
      expected: "https://zenn.dev/user/articles/xyz",
    },
  ];

  it.each(cases)("$name", ({ article, expected }) => {
    expect(articleHref(article)).toBe(expected);
  });
});

describe("viewTransitionSlug", () => {
  const cases: {
    name: string;
    article: Parameters<typeof viewTransitionSlug>[0];
    expected: string;
  }[] = [
    {
      name: "正常系: 内部記事のslugは記事ページと一致させるためそのまま返す",
      article: { slug: "my-post", isExternal: false },
      expected: "my-post",
    },
    {
      name: "正常系: 外部記事はURLの記号がCSS識別子として不正なので安全な文字に置換する",
      article: { slug: "https://qiita.com/user/items/abc", isExternal: true },
      expected: "https---qiita-com-user-items-abc",
    },
  ];

  it.each(cases)("$name", ({ article, expected }) => {
    expect(viewTransitionSlug(article)).toBe(expected);
  });
});

describe("thumbGradient", () => {
  it("正常系: 同じslugには常に同じグラデーションを返す(決定的)", () => {
    expect(thumbGradient("abcde")).toBe(thumbGradient("abcde"));
  });

  it("正常系: linear-gradientの文字列を返す", () => {
    expect(thumbGradient("any-slug")).toContain("linear-gradient");
  });
});

describe("sourceBadgeBackground", () => {
  const cases: {
    name: string;
    input: string | undefined;
    expected: string;
  }[] = [
    {
      name: "正常系: hexカラーはそのまま返す",
      input: "#55c500",
      expected: "#55c500",
    },
    {
      name: "異常系: hex以外の文字列はTailwindクラス等で背景に使えないのでinkを返す",
      input: "bg-green-500",
      expected: "var(--color-ink)",
    },
    {
      name: "異常系: 未指定の場合は色が決められないのでinkを返す",
      input: undefined,
      expected: "var(--color-ink)",
    },
  ];

  it.each(cases)("$name", ({ input, expected }) => {
    expect(sourceBadgeBackground(input)).toBe(expected);
  });
});
