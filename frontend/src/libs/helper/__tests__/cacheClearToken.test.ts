import { describe, it, expect } from "vitest";
import { isCacheClearTokenValid } from "../cacheClearToken";

describe("isCacheClearTokenValid", () => {
  const tests: {
    name: string;
    provided: string | null;
    expected: string | undefined;
    want: boolean;
  }[] = [
    {
      name: "正常系: 設定値と一致するトークンは許可される",
      provided: "secret-token",
      expected: "secret-token",
      want: true,
    },
    {
      name: "異常系: 設定値と異なるトークンを入れると不一致なので拒否される",
      provided: "wrong-token",
      expected: "secret-token",
      want: false,
    },
    {
      name: "異常系: 長さの異なるトークンを入れると不一致なので拒否される",
      provided: "secret",
      expected: "secret-token",
      want: false,
    },
    {
      name: "異常系: トークンを渡さないと比較対象が無いので拒否される",
      provided: null,
      expected: "secret-token",
      want: false,
    },
    {
      name: "異常系: 環境変数が未設定だと機能無効なので一致しても拒否される",
      provided: "",
      expected: undefined,
      want: false,
    },
    {
      name: "異常系: 環境変数が空文字だと機能無効なので空トークンでも拒否される",
      provided: "",
      expected: "",
      want: false,
    },
  ];

  for (const tt of tests) {
    it(tt.name, () => {
      expect(isCacheClearTokenValid(tt.provided, tt.expected)).toBe(tt.want);
    });
  }
});
