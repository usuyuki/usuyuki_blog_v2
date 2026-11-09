import { describe, it, expect, afterEach, vi } from "vitest";
import { getCacheClearToken, isCfConnectingIpTrusted } from "../env";

describe("getCacheClearToken", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const tests: {
    name: string;
    value: string | undefined;
    want: string | undefined;
  }[] = [
    {
      name: "正常系: CACHE_CLEAR_TOKENが設定されていればその値を返す",
      value: "secret-token",
      want: "secret-token",
    },
    {
      name: "異常系: CACHE_CLEAR_TOKENが未設定だと機能無効なのでundefinedになる",
      value: undefined,
      want: undefined,
    },
    {
      name: "異常系: CACHE_CLEAR_TOKENが空文字だと未設定と同じく機能無効なのでundefinedになる",
      value: "",
      want: undefined,
    },
  ];

  for (const tt of tests) {
    it(tt.name, () => {
      vi.stubEnv("CACHE_CLEAR_TOKEN", tt.value);
      expect(getCacheClearToken()).toBe(tt.want);
    });
  }
});

describe("isCfConnectingIpTrusted", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const tests: {
    name: string;
    value: string | undefined;
    want: boolean;
  }[] = [
    {
      name: "正常系: TRUST_CF_CONNECTING_IP=trueなら信用する",
      value: "true",
      want: true,
    },
    // "true"以外はすべて信用しない(誤設定でヘッダー偽装を許さないよう厳密に比較する)
    {
      name: "異常系: TRUST_CF_CONNECTING_IPが未設定だと信用しないのでfalseになる",
      value: undefined,
      want: false,
    },
    {
      name: "異常系: TRUST_CF_CONNECTING_IP=falseだと信用しないのでfalseになる",
      value: "false",
      want: false,
    },
    {
      name: '異常系: TRUST_CF_CONNECTING_IP=1だと"true"と一致しないのでfalseになる',
      value: "1",
      want: false,
    },
  ];

  for (const tt of tests) {
    it(tt.name, () => {
      vi.stubEnv("TRUST_CF_CONNECTING_IP", tt.value);
      expect(isCfConnectingIpTrusted()).toBe(tt.want);
    });
  }
});
