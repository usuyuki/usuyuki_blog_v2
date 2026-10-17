import { describe, it, expect } from "vitest";
import { resolveClientIp } from "../clientIp";

describe("resolveClientIp", () => {
  const tests: {
    name: string;
    cfConnectingIp: string | null;
    getClientAddress: () => string;
    want: string;
  }[] = [
    {
      name: "正常系: Cloudflare Tunnel経由ではCF-Connecting-IPを優先する",
      cfConnectingIp: "203.0.113.1",
      getClientAddress: () => "172.18.0.5",
      want: "203.0.113.1",
    },
    {
      name: "正常系: CF-Connecting-IPが無ければ接続元アドレスを使う",
      cfConnectingIp: null,
      getClientAddress: () => "127.0.0.1",
      want: "127.0.0.1",
    },
    {
      name: "異常系: 接続元アドレスの取得が例外を投げるとアドレス不明なのでunknownになる",
      cfConnectingIp: null,
      getClientAddress: () => {
        throw new Error("clientAddress is not available");
      },
      want: "unknown",
    },
  ];

  for (const tt of tests) {
    it(tt.name, () => {
      expect(resolveClientIp(tt.cfConnectingIp, tt.getClientAddress)).toBe(
        tt.want,
      );
    });
  }
});
