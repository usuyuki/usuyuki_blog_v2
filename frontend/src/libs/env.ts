import loggerService from "./logger.ts";

function isServer(): boolean {
  return typeof process !== "undefined" && !!process.env;
}

export function getGhostApiUrl(): string {
  const url = isServer()
    ? process.env.GHOST_API_URL
    : import.meta.env.GHOST_API_URL;
  if (!url) {
    loggerService.error("GHOST_API_URL environment variable is required");
    throw new Error("GHOST_API_URL environment variable is required");
  }
  return url;
}

export function getGhostContentKey(): string {
  const key = isServer()
    ? process.env.GHOST_CONTENT_KEY
    : import.meta.env.GHOST_CONTENT_KEY;
  if (!key) {
    loggerService.error("GHOST_CONTENT_KEY environment variable is required");
    throw new Error("GHOST_CONTENT_KEY environment variable is required");
  }
  return key;
}

export function getExternalBlogs(): string | undefined {
  return isServer()
    ? process.env.EXTERNAL_BLOGS
    : import.meta.env.EXTERNAL_BLOGS;
}

export function getFrontendUrl(): string {
  const url = isServer()
    ? process.env.FRONTEND_URL
    : import.meta.env.FRONTEND_URL;
  if (!url) {
    loggerService.error("FRONTEND_URL environment variable is required");
    throw new Error("FRONTEND_URL environment variable is required");
  }
  return url;
}
export function getGhostFrontUrl(): string {
  const url = isServer()
    ? process.env.GHOST_FRONT_URL
    : import.meta.env.GHOST_FRONT_URL;
  if (!url) {
    loggerService.error("GHOST_FRONT_URL environment variable is required");
    throw new Error("GHOST_FRONT_URL environment variable is required");
  }
  return url;
}

// 記事詳細ページの ?debug= による手動キャッシュクリア用トークン。未設定なら機能を無効にする。
// 秘密値なのでSSR時のprocess.envからのみ読む(import.meta.env経由だとPUBLIC_接頭辞を付けた際にクライアントへ埋め込まれうる)
export function getCacheClearToken(): string | undefined {
  if (!isServer()) return undefined;
  return process.env.CACHE_CLEAR_TOKEN || undefined;
}

// CF-Connecting-IPヘッダーをクライアントIPとして信用するか。
// Cloudflare Tunnel経由でしか到達できない本番だけ"true"にする(それ以外ではヘッダーを偽装できるため)
export function isCfConnectingIpTrusted(): boolean {
  if (!isServer()) return false;
  return process.env.TRUST_CF_CONNECTING_IP === "true";
}

export function getNsfwBlocklist(): Set<string> {
  const raw = isServer()
    ? process.env.REACTIONS_NSFW_BLOCKLIST
    : import.meta.env.REACTIONS_NSFW_BLOCKLIST;
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((s: string) => s.trim())
      .filter((s: string) => s.length > 0),
  );
}
