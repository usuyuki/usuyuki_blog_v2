import { describe, expect, it } from "vitest";
import { getReactionListMaxHeight } from "../reactionListMaxHeight";

describe("getReactionListMaxHeight", () => {
  it.each([
    {
      name: "正常系: サイドバーで折りたたみ時は2行分(7rem)を、配置側が渡した上限でさらに抑える",
      collapsed: true,
      scrollable: true,
      expected:
        "min(7rem, max(var(--reaction-list-max-height, 13rem), 3.5rem))",
    },
    {
      name: "正常系: サイドバーで展開時は配置側が渡した上限(未指定なら4行分)まで広げる",
      collapsed: false,
      scrollable: true,
      expected: "max(var(--reaction-list-max-height, 13rem), 3.5rem)",
    },
    {
      name: "正常系: サイドバー以外で折りたたみ時は2行分(7rem)に固定する",
      collapsed: true,
      scrollable: false,
      expected: "7rem",
    },
    {
      name: "正常系: サイドバー以外で展開時は上限を設けず全件表示する",
      collapsed: false,
      scrollable: false,
      expected: undefined,
    },
  ])("$name", ({ collapsed, scrollable, expected }) => {
    expect(getReactionListMaxHeight(collapsed, scrollable)).toBe(expected);
  });
});
