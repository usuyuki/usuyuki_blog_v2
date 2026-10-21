// リクエスト元のIPアドレスを決定する。
// 本番はCloudflare Tunnel(cloudflared)経由でしか到達できない(astroはポートを公開していない)ため、
// 接続元アドレスは常にcloudflaredコンテナになり、実クライアントのIPはCloudflareが付与する
// CF-Connecting-IPヘッダーにある。
// ただしこのヘッダーはクライアントが自由に付けられるため、Cloudflareを経由しない環境(開発環境など)で
// 信用するとレート制限を素通りされる。trustCfConnectingIp(環境変数TRUST_CF_CONNECTING_IP)が
// 有効なときだけ採用し、それ以外は接続元アドレスを使う。どちらも取れなければnullを返す。
export function resolveClientIp({
  cfConnectingIp,
  trustCfConnectingIp,
  getClientAddress,
}: {
  cfConnectingIp: string | null;
  trustCfConnectingIp: boolean;
  getClientAddress: () => string;
}): string | null {
  if (trustCfConnectingIp && cfConnectingIp) return cfConnectingIp.trim();
  try {
    // AstroのclientAddressはアダプタが対応していない場合に例外を投げる
    return getClientAddress() || null;
  } catch {
    return null;
  }
}

const IPV6_GROUP_COUNT = 8;
const IPV6_GROUP_PATTERN = /^[0-9a-f]{1,4}$/;

// 末尾がIPv4表記(::ffff:192.0.2.1 など)のIPv6アドレスを、16進2グループの表記に置き換える
function replaceEmbeddedIpv4(address: string): string | null {
  const lastColon = address.lastIndexOf(":");
  const tail = address.slice(lastColon + 1);
  if (!tail.includes(".")) return address;

  const octets = tail.split(".").map(Number);
  if (
    octets.length !== 4 ||
    octets.some((o) => !Number.isInteger(o) || o < 0 || o > 255)
  ) {
    return null;
  }
  const high = ((octets[0] << 8) | octets[1]).toString(16);
  const low = ((octets[2] << 8) | octets[3]).toString(16);
  return `${address.slice(0, lastColon + 1)}${high}:${low}`;
}

// IPv6アドレスを省略なしの8グループ(小文字・先頭ゼロなし)に展開する。不正な表記ならnullを返す
export function expandIpv6(ip: string): string[] | null {
  // fe80::1%eth0 のようなゾーンIDは除く
  const withoutZone = ip.split("%")[0].toLowerCase();
  const address = replaceEmbeddedIpv4(withoutZone);
  if (address === null) return null;

  const halves = address.split("::");
  if (halves.length > 2) return null;

  const toGroups = (part: string) => (part === "" ? [] : part.split(":"));
  const head = toGroups(halves[0]);
  const tail = halves.length === 2 ? toGroups(halves[1]) : [];
  const missing = IPV6_GROUP_COUNT - head.length - tail.length;
  // "::"があるなら1グループ以上を省略していること、無いならちょうど8グループであることが必要
  if (halves.length === 2 ? missing < 1 : missing !== 0) return null;

  const groups = [...head, ...Array(missing).fill("0"), ...tail];
  if (!groups.every((g) => IPV6_GROUP_PATTERN.test(g))) return null;
  return groups.map((g) => Number.parseInt(g, 16).toString(16));
}

// レート制限のキーにするため、IPアドレスを利用者単位に丸める。
// IPv6は一般に1契約へ/64がまるごと割り当てられ、その中でアドレスを替えれば別人に見えてしまうため、
// 上位64bit(/64プレフィックス)にまとめる。IPv4射影アドレス(::ffff:x.x.x.x)はIPv4として扱う。
// IPv4や解釈できない文字列はそのまま返す
export function toRateLimitKey(ip: string): string {
  if (!ip.includes(":")) return ip;

  const groups = expandIpv6(ip);
  if (groups === null) return ip;

  const isIpv4Mapped =
    groups.slice(0, 5).every((g) => g === "0") && groups[5] === "ffff";
  if (isIpv4Mapped) {
    const high = Number.parseInt(groups[6], 16);
    const low = Number.parseInt(groups[7], 16);
    return [high >> 8, high & 0xff, low >> 8, low & 0xff].join(".");
  }
  return `${groups.slice(0, 4).join(":")}::/64`;
}
