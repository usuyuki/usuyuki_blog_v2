import { describe, it, expect } from "vitest";
import { createFixedWindowRateLimiter } from "../rateLimiter";

describe("createFixedWindowRateLimiter", () => {
  const tests: {
    name: string;
    // [経過時間ms, キー] の順にtryConsumeを呼ぶ
    calls: [number, string][];
    want: boolean[];
  }[] = [
    {
      name: "正常系: 上限回数まではすべて許可される",
      calls: [
        [0, "1.1.1.1"],
        [10, "1.1.1.1"],
        [20, "1.1.1.1"],
      ],
      want: [true, true, true],
    },
    {
      name: "異常系: 同一ウィンドウ内で上限を超えたリクエストを入れると上限超過なので拒否される",
      calls: [
        [0, "1.1.1.1"],
        [10, "1.1.1.1"],
        [20, "1.1.1.1"],
        [30, "1.1.1.1"],
      ],
      want: [true, true, true, false],
    },
    {
      name: "正常系: ウィンドウが過ぎるとカウントがリセットされ再び許可される",
      calls: [
        [0, "1.1.1.1"],
        [10, "1.1.1.1"],
        [20, "1.1.1.1"],
        [30, "1.1.1.1"],
        [1000, "1.1.1.1"],
      ],
      want: [true, true, true, false, true],
    },
    {
      name: "正常系: キーごとに独立してカウントされる",
      calls: [
        [0, "1.1.1.1"],
        [10, "1.1.1.1"],
        [20, "1.1.1.1"],
        [30, "2.2.2.2"],
      ],
      want: [true, true, true, true],
    },
  ];

  for (const tt of tests) {
    it(tt.name, () => {
      let current = 0;
      const limiter = createFixedWindowRateLimiter({
        limit: 3,
        windowMs: 1000,
        now: () => current,
      });
      const got = tt.calls.map(([at, key]) => {
        current = at;
        return limiter.tryConsume(key);
      });
      expect(got).toEqual(tt.want);
    });
  }

  it("正常系: 期限切れのキーは保持上限を超えたときに掃除される", () => {
    let current = 0;
    const limiter = createFixedWindowRateLimiter({
      limit: 1,
      windowMs: 1000,
      maxKeys: 2,
      now: () => current,
    });
    limiter.tryConsume("a");
    limiter.tryConsume("b");
    current = 2000;
    limiter.tryConsume("c");
    // a, bは期限切れで掃除され、cのみ残る
    expect(limiter.size()).toBe(1);
  });
});
