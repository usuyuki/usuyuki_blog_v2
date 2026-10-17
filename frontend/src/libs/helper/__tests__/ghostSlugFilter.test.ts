import { describe, it, expect } from "vitest";
import { buildGhostSlugFilter } from "../ghostSlugFilter";

describe("buildGhostSlugFilter", () => {
  const tests: {
    name: string;
    slugs: string[];
    want: string | null;
  }[] = [
    {
      name: "正常系: 有効なslugのみならそのままNQLフィルタになる",
      slugs: ["post-a", "post_b", "e3-82-92"],
      want: "slug:[post-a,post_b,e3-82-92]",
    },
    {
      name: "正常系: NQLメタ文字を含むslugは除外され有効なslugだけが残る",
      slugs: [
        "post-a",
        "!x'", // ! と ' はslugに使えない文字なので除外
        "zz]+slug:-[victim", // ] + : [ でNQL構造を変えられるので除外
        "a,b", // , で値を分割できるので除外
        "post-b",
      ],
      want: "slug:[post-a,post-b]",
    },
    {
      name: "正常系: 空配列ならnullを返す",
      slugs: [],
      want: null,
    },
    {
      name: "正常系: 有効なslugが1件も無ければnullを返す",
      slugs: ["!x'", "a]b"],
      want: null,
    },
  ];

  for (const tt of tests) {
    it(tt.name, () => {
      expect(buildGhostSlugFilter(tt.slugs)).toBe(tt.want);
    });
  }
});
