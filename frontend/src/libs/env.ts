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

// /dev配下(プレビューページ)を本番で開くためのBasic認証の情報。
// どちらかが未設定なら本番では/dev配下を404にする(devPageAuth.ts参照)
export function getDevPagesCredentials():
  | { user: string; password: string }
  | undefined {
  const user = isServer()
    ? process.env.DEV_PAGES_BASIC_AUTH_USER
    : import.meta.env.DEV_PAGES_BASIC_AUTH_USER;
  const password = isServer()
    ? process.env.DEV_PAGES_BASIC_AUTH_PASSWORD
    : import.meta.env.DEV_PAGES_BASIC_AUTH_PASSWORD;
  return user && password ? { user, password } : undefined;
}

// 開発用のcompose.ymlでだけtrueにし、/dev配下を認証なしで開けるようにする
export function isDevPagesAuthDisabled(): boolean {
  const value = isServer()
    ? process.env.DEV_PAGES_AUTH_DISABLED
    : import.meta.env.DEV_PAGES_AUTH_DISABLED;
  return value === "true";
}
