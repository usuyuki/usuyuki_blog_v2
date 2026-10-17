// リクエスト元のIPアドレスを決定する。
// 本番はCloudflare Tunnel(cloudflared)経由でしか到達できない(astroはポートを公開していない)ため、
// 接続元アドレスは常にcloudflaredコンテナになる。実クライアントのIPはCloudflareが付与する
// CF-Connecting-IPヘッダーにあるので、それを優先する。
// 開発環境など同ヘッダーが無い場合は接続元アドレスを使い、それも取れなければ"unknown"を返す。
export function resolveClientIp(
  cfConnectingIp: string | null,
  getClientAddress: () => string,
): string {
  if (cfConnectingIp) return cfConnectingIp;
  try {
    // AstroのclientAddressはアダプタが対応していない場合に例外を投げる
    return getClientAddress();
  } catch {
    return "unknown";
  }
}
