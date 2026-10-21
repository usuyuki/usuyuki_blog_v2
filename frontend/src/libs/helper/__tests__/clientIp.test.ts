import { describe, it, expect } from "vitest";
import { expandIpv6, resolveClientIp, toRateLimitKey } from "../clientIp";

describe("resolveClientIp", () => {
  const tests: {
    name: string;
    cfConnectingIp: string | null;
    trustCfConnectingIp: boolean;
    getClientAddress: () => string;
    want: string | null;
  }[] = [
    {
      name: "正常系: CF-Connecting-IPを信用する設定ならヘッダーの値を優先する",
      cfConnectingIp: "203.0.113.1",
      trustCfConnectingIp: true,
      getClientAddress: () => "172.18.0.5",
      want: "203.0.113.1",
    },
    {
      name: "正常系: CF-Connecting-IPを信用しない設定ならヘッダーを無視して接続元アドレスを使う",
      cfConnectingIp: "203.0.113.1",
      trustCfConnectingIp: false,
      getClientAddress: () => "127.0.0.1",
      want: "127.0.0.1",
    },
    {
      name: "正常系: 信用する設定でもCF-Connecting-IPが無ければ接続元アドレスを使う",
      cfConnectingIp: null,
      trustCfConnectingIp: true,
      getClientAddress: () => "127.0.0.1",
      want: "127.0.0.1",
    },
    {
      name: "異常系: 接続元アドレスの取得が例外を投げるとアドレス不明なのでnullになる",
      cfConnectingIp: null,
      trustCfConnectingIp: false,
      getClientAddress: () => {
        throw new Error("clientAddress is not available");
      },
      want: null,
    },
    {
      name: "異常系: 接続元アドレスが空文字だとアドレス不明なのでnullになる",
      cfConnectingIp: null,
      trustCfConnectingIp: false,
      getClientAddress: () => "",
      want: null,
    },
  ];

  for (const tt of tests) {
    it(tt.name, () => {
      expect(
        resolveClientIp({
          cfConnectingIp: tt.cfConnectingIp,
          trustCfConnectingIp: tt.trustCfConnectingIp,
          getClientAddress: tt.getClientAddress,
        }),
      ).toBe(tt.want);
    });
  }
});

describe("expandIpv6", () => {
  const tests: { name: string; ip: string; want: string[] | null }[] = [
    {
      name: "正常系: ::で省略されたアドレスを8グループに展開する",
      ip: "2001:db8::1",
      want: ["2001", "db8", "0", "0", "0", "0", "0", "1"],
    },
    {
      name: "正常系: 大文字・先頭ゼロ付きのグループを小文字・先頭ゼロなしにそろえる",
      ip: "2001:0DB8:0000:0000:0000:0000:0000:0001",
      want: ["2001", "db8", "0", "0", "0", "0", "0", "1"],
    },
    {
      name: "正常系: 末尾のIPv4表記を16進2グループに変換する",
      ip: "::ffff:192.0.2.1",
      want: ["0", "0", "0", "0", "0", "ffff", "c000", "201"],
    },
    {
      name: "正常系: ゾーンIDは無視する",
      ip: "fe80::1%eth0",
      want: ["fe80", "0", "0", "0", "0", "0", "0", "1"],
    },
    {
      name: "異常系: ::を2回含むアドレスを入れると省略位置が一意に決まらないのでnullになる",
      ip: "2001::db8::1",
      want: null,
    },
    {
      name: "異常系: 16進でないグループを入れると不正な表記なのでnullになる",
      ip: "2001:db8::zzzz",
      want: null,
    },
    {
      name: "異常系: グループが8個に満たないアドレスを入れると不正な表記なのでnullになる",
      ip: "2001:db8:1",
      want: null,
    },
    {
      name: "異常系: 範囲外のIPv4表記を入れると不正な表記なのでnullになる",
      ip: "::ffff:999.0.2.1",
      want: null,
    },
  ];

  for (const tt of tests) {
    it(tt.name, () => {
      expect(expandIpv6(tt.ip)).toEqual(tt.want);
    });
  }
});

describe("toRateLimitKey", () => {
  const tests: { name: string; ip: string; want: string }[] = [
    {
      name: "正常系: IPv4はそのまま返す",
      ip: "203.0.113.1",
      want: "203.0.113.1",
    },
    {
      name: "正常系: IPv6は/64プレフィックスにまとめる",
      ip: "2001:db8:1:2:aaaa:bbbb:cccc:dddd",
      want: "2001:db8:1:2::/64",
    },
    {
      name: "正常系: 同じ/64内の別アドレスは同じキーになる",
      ip: "2001:db8:1:2::ffff",
      want: "2001:db8:1:2::/64",
    },
    {
      name: "正常系: IPv4射影アドレスはIPv4として扱う",
      ip: "::ffff:203.0.113.1",
      want: "203.0.113.1",
    },
    {
      name: "異常系: 解釈できないIPv6表記を入れると丸められないのでそのまま返す",
      ip: "not:an:ip",
      want: "not:an:ip",
    },
  ];

  for (const tt of tests) {
    it(tt.name, () => {
      expect(toRateLimitKey(tt.ip)).toBe(tt.want);
    });
  }
});
