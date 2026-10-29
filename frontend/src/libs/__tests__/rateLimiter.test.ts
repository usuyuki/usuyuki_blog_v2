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

  describe("保持キー数の上限", () => {
    const tests: {
      name: string;
      // [経過時間ms, キー] の順にtryConsumeを呼ぶ
      calls: [number, string][];
      want: boolean[];
      wantSize: number;
    }[] = [
      {
        name: "異常系: 保持上限に達した状態で新しいキーを入れると上限を超えるので拒否され、保持数も増えない",
        calls: [
          [0, "a"],
          [10, "b"],
          [20, "c"],
        ],
        want: [true, true, false],
        wantSize: 2,
      },
      {
        name: "正常系: 保持上限に達していても既存キーは通常どおり判定される",
        calls: [
          [0, "a"],
          [10, "b"],
          [20, "a"],
          [30, "a"],
        ],
        // limit=2なので3回目のaは上限超過
        want: [true, true, true, false],
        wantSize: 2,
      },
      {
        name: "正常系: 期限切れのキーは掃除されるので新しいキーを受け付けられる",
        calls: [
          [0, "a"],
          [10, "b"],
          // a(resetAt=1000)だけが期限切れで掃除され、bは残る
          [1005, "c"],
        ],
        want: [true, true, true],
        wantSize: 2,
      },
      {
        name: "正常系: ウィンドウを作り直したキーは末尾に回るので、後から期限切れになる順序が保たれる",
        calls: [
          [0, "a"],
          [500, "b"],
          // aを作り直す(resetAt=2100)。b(resetAt=1500)より後ろに並ぶ
          [1100, "a"],
          // bだけが期限切れで掃除され、cを受け付けられる
          [1600, "c"],
        ],
        want: [true, true, true, true],
        wantSize: 2,
      },
    ];

    for (const tt of tests) {
      it(tt.name, () => {
        let current = 0;
        const limiter = createFixedWindowRateLimiter({
          limit: 2,
          windowMs: 1000,
          maxKeys: 2,
          now: () => current,
        });
        const got = tt.calls.map(([at, key]) => {
          current = at;
          return limiter.tryConsume(key);
        });
        expect(got).toEqual(tt.want);
        expect(limiter.size()).toBe(tt.wantSize);
      });
    }
  });
});
